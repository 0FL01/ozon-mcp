use crate::config::AppConfig;
use crate::extension_server::{ExtensionServer, ExtensionServerConfig};
use crate::file_logger::FileLogger;
use crate::transport::DirectTransport;
use crate::unified_backend::UnifiedBackend;
use anyhow::{Context, Result};
use rmcp::ServiceExt;
use rmcp::transport::stdio;
use std::sync::Arc;

pub struct App {
    config: AppConfig,
    logger: FileLogger,
    extension_server: Arc<ExtensionServer>,
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
        let transport = DirectTransport::new(Arc::clone(&extension_server));
        let backend = UnifiedBackend::new(transport);

        Ok(Self {
            config,
            logger,
            extension_server,
            backend,
        })
    }

    pub async fn run(self) -> Result<()> {
        let App {
            config,
            logger,
            extension_server,
            backend,
        } = self;

        logger.info("Starting Ozon MCP Rust scaffold (iteration 2).");

        if let Some(addr) = config.socket_addr() {
            logger.info(&format!("Configured extension bridge endpoint: {addr}"));
        } else {
            logger.info(&format!(
                "Configured extension bridge endpoint: {}:{}",
                config.mcp_host, config.mcp_port
            ));
        }

        logger.debug(&format!("Selected transport: {}", backend.transport_name()));

        let tool_count = backend.list_tools().len();
        logger.info(&format!("Registered {tool_count} tool descriptors."));
        logger.info("Handlers are intentionally stubs in migration iteration 2.");

        if let Err(error) = extension_server.start().await {
            logger.info(&format!(
                "Extension bridge startup issue: {error}. MCP stdio server will continue running."
            ));
        }

        let service = backend
            .serve(stdio())
            .await
            .context("failed to start MCP stdio service")?;

        let quit_reason = service
            .waiting()
            .await
            .context("MCP stdio service terminated unexpectedly")?;

        extension_server.stop().await?;
        logger.debug(&format!("MCP service terminated: {quit_reason:?}"));

        logger.info("Rust scaffold startup completed.");
        Ok(())
    }
}
