use clap::Parser;
use std::net::{IpAddr, SocketAddr};

fn default_host() -> String {
    String::from("127.0.0.1")
}

#[derive(Debug, Clone, Parser)]
#[command(
    name = "ozon-mcp",
    version,
    about = "Iteration 1 Rust scaffold for Ozon MCP migration"
)]
pub struct AppConfig {
    #[arg(long, env = "MCP_HOST", default_value_t = default_host())]
    pub mcp_host: String,

    #[arg(long, env = "MCP_PORT", default_value_t = 5555)]
    pub mcp_port: u16,

    #[arg(long, env = "DEBUG", default_value_t = false)]
    pub debug: bool,
}

impl AppConfig {
    pub fn from_env_and_args() -> Self {
        Self::parse()
    }

    pub fn socket_addr(&self) -> Option<SocketAddr> {
        let ip = self.mcp_host.parse::<IpAddr>().ok()?;
        Some(SocketAddr::new(ip, self.mcp_port))
    }
}
