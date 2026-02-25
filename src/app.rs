use crate::config::AppConfig;
use crate::extension_server::{ExtensionServer, ExtensionServerConfig};
use crate::file_logger::FileLogger;
use crate::transport::DirectTransport;
use crate::unified_backend::UnifiedBackend;
use anyhow::Result;
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
        self.logger
            .info("Starting Ozon MCP Rust scaffold (iteration 2).");

        if let Some(addr) = self.config.socket_addr() {
            self.logger
                .info(&format!("Configured extension bridge endpoint: {addr}"));
        } else {
            self.logger.info(&format!(
                "Configured extension bridge endpoint: {}:{}",
                self.config.mcp_host, self.config.mcp_port
            ));
        }

        self.logger.debug(&format!(
            "Selected transport: {}",
            self.backend.transport_name()
        ));

        let tool_count = self.backend.list_tools().len();
        self.logger
            .info(&format!("Registered {tool_count} tool descriptors."));
        self.logger
            .info("Handlers are intentionally stubs in migration iteration 2.");

        self.extension_server.start().await?;
        self.extension_server.stop().await?;

        self.logger.info("Rust scaffold startup completed.");
        Ok(())
    }
}
