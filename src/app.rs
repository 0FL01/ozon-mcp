use crate::config::AppConfig;
use crate::extension_server::{ExtensionServer, ExtensionServerConfig};
use crate::file_logger::FileLogger;
use crate::ownership_arbiter::{OwnershipArbiter, OwnershipDecision};
use crate::transport::DirectTransport;
use crate::unified_backend::{OwnershipStatusState, UnifiedBackend};
use anyhow::{Context, Result};
use rmcp::ServiceExt;
use rmcp::transport::stdio;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::time::{MissedTickBehavior, interval};

pub struct App {
    config: AppConfig,
    logger: FileLogger,
    extension_server: Arc<ExtensionServer>,
    tools_enabled: Arc<AtomicBool>,
    ownership_status: OwnershipStatusState,
    backend: UnifiedBackend<DirectTransport>,
}

impl App {
    pub fn build(config: AppConfig) -> Result<Self> {
        let logger = FileLogger::new(config.debug, None)?;

        let server_config = ExtensionServerConfig {
            host: config.mcp_host.clone(),
            port: config.mcp_port,
        };
        let extension_server = Arc::new(ExtensionServer::new(server_config));
        let tools_enabled = Arc::new(AtomicBool::new(false));
        let ownership_status = OwnershipStatusState::new();
        let transport = DirectTransport::new(Arc::clone(&extension_server));
        let backend = UnifiedBackend::new(
            transport,
            Arc::clone(&tools_enabled),
            ownership_status.clone(),
        );

        Ok(Self {
            config,
            logger,
            extension_server,
            tools_enabled,
            ownership_status,
            backend,
        })
    }

    pub async fn run(self) -> Result<()> {
        let App {
            config,
            logger,
            extension_server,
            tools_enabled,
            ownership_status,
            backend,
        } = self;

        let ownership = OwnershipArbiter::new();
        ownership_status.initialize(ownership.instance_id(), ownership.state_file());

        logger.info("Starting Ozon MCP Rust scaffold (iteration 2).");
        logger.info(&format!(
            "Ownership arbiter instance: {}",
            ownership.instance_id()
        ));
        logger.debug(&format!(
            "Ownership lease state file: {}",
            ownership.state_file().display()
        ));

        if let Some(addr) = config.socket_addr() {
            logger.info(&format!("Configured extension bridge endpoint: {addr}"));
        } else {
            logger.info(&format!(
                "Configured extension bridge endpoint: {}:{}",
                config.mcp_host, config.mcp_port
            ));
        }

        logger.debug(&format!("Selected transport: {}", backend.transport_name()));

        let tool_count = backend.total_tool_count();
        logger.info(&format!(
            "Registered {tool_count} tool descriptors (dynamic visibility enabled)."
        ));
        logger.info("Handlers are intentionally stubs in migration iteration 2.");

        let mut bridge_running = false;
        let mut was_owner = false;
        let initial_decision = reconcile_ownership(
            &logger,
            &ownership,
            &extension_server,
            &tools_enabled,
            &mut bridge_running,
            &mut was_owner,
        )
        .await?;
        ownership_status.apply_decision(&initial_decision);

        let service = backend
            .serve(stdio())
            .await
            .context("failed to start MCP stdio service")?;

        let mut lease_renewal = interval(ownership.renew_interval());
        lease_renewal.set_missed_tick_behavior(MissedTickBehavior::Skip);

        let wait_for_stop = service.waiting();
        tokio::pin!(wait_for_stop);

        let quit_reason = loop {
            tokio::select! {
                result = &mut wait_for_stop => {
                    let reason = result.context("MCP stdio service terminated unexpectedly")?;
                    break reason;
                }
                _ = lease_renewal.tick() => {
                    match reconcile_ownership(
                        &logger,
                        &ownership,
                        &extension_server,
                        &tools_enabled,
                        &mut bridge_running,
                        &mut was_owner,
                    ).await {
                        Ok(decision) => {
                            ownership_status.apply_decision(&decision);
                        }
                        Err(error) => {
                            logger.info(&format!("Ownership reconciliation issue: {error}"));
                            ownership_status.mark_fail_closed(format!("reconcile_error: {error}"));
                            fail_closed_bridge(
                                &logger,
                                &extension_server,
                                &tools_enabled,
                                &mut bridge_running,
                            )
                            .await;
                        }
                    }
                }
            }
        };

        tools_enabled.store(false, Ordering::Release);
        if bridge_running {
            extension_server.stop().await?;
        }

        ownership.release_if_owner()?;
        logger.debug(&format!("MCP service terminated: {quit_reason:?}"));

        logger.info("Rust scaffold startup completed.");
        Ok(())
    }
}

async fn reconcile_ownership(
    logger: &FileLogger,
    ownership: &OwnershipArbiter,
    extension_server: &Arc<ExtensionServer>,
    tools_enabled: &Arc<AtomicBool>,
    bridge_running: &mut bool,
    was_owner: &mut bool,
) -> Result<OwnershipDecision> {
    let decision = ownership.tick()?;
    let should_own = decision.is_owner();

    if should_own && !*bridge_running {
        match extension_server.start().await {
            Ok(()) => {
                *bridge_running = true;
                logger.info("Ownership active: extension bridge started.");
            }
            Err(error) => {
                logger.info(&format!(
                    "Ownership active but extension bridge start failed: {error}. Will retry on next lease tick."
                ));
            }
        }
    }

    if !should_own && *bridge_running {
        tools_enabled.store(false, Ordering::Release);
        extension_server.stop().await?;
        *bridge_running = false;
        logger.info("Ownership passive: extension bridge stopped.");
    }

    let tools_now_enabled = should_own && *bridge_running;
    tools_enabled.store(tools_now_enabled, Ordering::Release);

    if *was_owner != should_own {
        let owner_label = decision.owner_instance_id.as_deref().unwrap_or("none");
        logger.info(&format!(
            "Ownership mode switched: {} (owner={}, reason={})",
            if should_own { "owner" } else { "passive" },
            owner_label,
            decision.reason
        ));
    }

    *was_owner = should_own;
    Ok(decision)
}

async fn fail_closed_bridge(
    logger: &FileLogger,
    extension_server: &Arc<ExtensionServer>,
    tools_enabled: &Arc<AtomicBool>,
    bridge_running: &mut bool,
) {
    tools_enabled.store(false, Ordering::Release);
    if *bridge_running {
        if let Err(error) = extension_server.stop().await {
            logger.info(&format!(
                "Fail-closed bridge stop issue: {error}. Tools stay disabled."
            ));
        }
        *bridge_running = false;
    }
}
