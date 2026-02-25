use anyhow::Result;
use ozon_mcp::app::App;
use ozon_mcp::config::AppConfig;

#[tokio::main]
async fn main() -> Result<()> {
    let config = AppConfig::from_env_and_args();
    let app = App::build(config)?;
    app.run().await
}
