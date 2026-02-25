use crate::extension_server::{ExtensionCommand, ExtensionResponse, ExtensionServer};
use anyhow::Result;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

pub trait Transport: Send + Sync {
    fn send_command<'a>(
        &'a self,
        command: ExtensionCommand,
    ) -> BoxFuture<'a, Result<ExtensionResponse>>;

    fn close<'a>(&'a self) -> BoxFuture<'a, Result<()>>;

    fn name(&self) -> &'static str;
}

#[derive(Debug, Clone)]
pub struct DirectTransport {
    server: Arc<ExtensionServer>,
}

impl DirectTransport {
    pub fn new(server: Arc<ExtensionServer>) -> Self {
        Self { server }
    }
}

impl Transport for DirectTransport {
    fn send_command<'a>(
        &'a self,
        command: ExtensionCommand,
    ) -> BoxFuture<'a, Result<ExtensionResponse>> {
        Box::pin(async move { self.server.send_command(command).await })
    }

    fn close<'a>(&'a self) -> BoxFuture<'a, Result<()>> {
        Box::pin(async move { self.server.stop().await })
    }

    fn name(&self) -> &'static str {
        "direct-transport"
    }
}
