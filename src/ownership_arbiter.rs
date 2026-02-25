use anyhow::{Context, Result};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const DEFAULT_LEASE_TTL_MS: u64 = 6_000;
const DEFAULT_RENEW_INTERVAL_MS: u64 = 1_000;

#[derive(Debug, Clone)]
pub struct OwnershipConfig {
    pub state_file: PathBuf,
    pub lease_ttl: Duration,
    pub renew_interval: Duration,
}

impl OwnershipConfig {
    pub fn from_env() -> Self {
        let state_file = env::var("OZON_MCP_OWNER_FILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| default_state_file_path());

        let lease_ttl_ms = parse_u64_env("OZON_MCP_LEASE_TTL_MS").unwrap_or(DEFAULT_LEASE_TTL_MS);
        let renew_interval_ms =
            parse_u64_env("OZON_MCP_LEASE_RENEW_MS").unwrap_or(DEFAULT_RENEW_INTERVAL_MS);

        let lease_ttl = Duration::from_millis(lease_ttl_ms.max(1_000));
        let renew_interval_cap = (lease_ttl.as_millis() / 2).max(1) as u64;
        let renew_interval_ms = renew_interval_ms.max(250).min(renew_interval_cap);
        let renew_interval = Duration::from_millis(renew_interval_ms);

        Self {
            state_file,
            lease_ttl,
            renew_interval,
        }
    }
}

#[derive(Debug, Clone)]
pub struct InstanceIdentity {
    pub instance_id: String,
    pub pid: u32,
    pub started_at_ms: u64,
}

impl InstanceIdentity {
    fn new() -> Self {
        let pid = process::id();
        let started_at_ms = now_ms();
        let started_at_ns = now_ns();
        let instance_id = format!("{}-{}-{}", pid, started_at_ms, started_at_ns);

        Self {
            instance_id,
            pid,
            started_at_ms,
        }
    }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum OwnershipMode {
    Owner,
    Passive,
}

#[derive(Debug, Clone)]
pub struct OwnershipDecision {
    pub mode: OwnershipMode,
    pub owner_instance_id: Option<String>,
    pub reason: &'static str,
}

impl OwnershipDecision {
    pub fn is_owner(&self) -> bool {
        self.mode == OwnershipMode::Owner
    }
}

#[derive(Debug)]
pub struct OwnershipArbiter {
    config: OwnershipConfig,
    identity: InstanceIdentity,
}

impl OwnershipArbiter {
    pub fn new() -> Self {
        Self {
            config: OwnershipConfig::from_env(),
            identity: InstanceIdentity::new(),
        }
    }

    pub fn renew_interval(&self) -> Duration {
        self.config.renew_interval
    }

    pub fn state_file(&self) -> &Path {
        &self.config.state_file
    }

    pub fn instance_id(&self) -> &str {
        &self.identity.instance_id
    }

    pub fn tick(&self) -> Result<OwnershipDecision> {
        let mut file = self.open_state_file()?;
        file.lock_exclusive()
            .context("failed to acquire ownership lock")?;

        let now = now_ms();
        let current = read_record(&mut file);
        let decision = decide_next_owner(
            now,
            &self.identity,
            current,
            self.config.lease_ttl,
            &mut file,
        )?;

        Ok(decision)
    }

    pub fn release_if_owner(&self) -> Result<()> {
        if !self.config.state_file.exists() {
            return Ok(());
        }

        let mut file = self.open_state_file()?;
        file.lock_exclusive()
            .context("failed to acquire ownership lock for release")?;

        let current = read_record(&mut file);
        if let Some(record) = current
            && record.owner_instance_id == self.identity.instance_id
        {
            file.set_len(0)
                .context("failed to truncate ownership state file")?;
            file.seek(SeekFrom::Start(0))
                .context("failed to seek ownership state file")?;
            file.sync_data()
                .context("failed to sync ownership state file")?;
        }

        Ok(())
    }

    fn open_state_file(&self) -> Result<File> {
        if let Some(parent) = self.config.state_file.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!(
                    "failed to create ownership state directory: {}",
                    parent.display()
                )
            })?;
        }

        OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(&self.config.state_file)
            .with_context(|| {
                format!(
                    "failed to open ownership state file: {}",
                    self.config.state_file.display()
                )
            })
    }
}

impl Default for OwnershipArbiter {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LeaseRecord {
    owner_instance_id: String,
    owner_pid: u32,
    owner_started_at_ms: u64,
    lease_until_ms: u64,
    generation: u64,
}

impl LeaseRecord {
    fn new(identity: &InstanceIdentity, now: u64, lease_ttl: Duration, generation: u64) -> Self {
        let lease_ms = lease_ttl.as_millis().min(u128::from(u64::MAX)) as u64;
        let lease_until_ms = now.saturating_add(lease_ms);

        Self {
            owner_instance_id: identity.instance_id.clone(),
            owner_pid: identity.pid,
            owner_started_at_ms: identity.started_at_ms,
            lease_until_ms,
            generation,
        }
    }
}

fn decide_next_owner(
    now: u64,
    identity: &InstanceIdentity,
    current: Option<LeaseRecord>,
    lease_ttl: Duration,
    file: &mut File,
) -> Result<OwnershipDecision> {
    let stale_or_missing = match current.as_ref() {
        Some(record) => !is_record_active(record, now),
        None => true,
    };

    if stale_or_missing {
        let generation = current
            .as_ref()
            .map(|record| record.generation.saturating_add(1))
            .unwrap_or(1);
        let next = LeaseRecord::new(identity, now, lease_ttl, generation);
        write_record(file, &next)?;

        return Ok(OwnershipDecision {
            mode: OwnershipMode::Owner,
            owner_instance_id: Some(next.owner_instance_id),
            reason: "claimed_stale_or_missing_lease",
        });
    }

    let Some(current) = current else {
        let next = LeaseRecord::new(identity, now, lease_ttl, 1);
        write_record(file, &next)?;

        return Ok(OwnershipDecision {
            mode: OwnershipMode::Owner,
            owner_instance_id: Some(next.owner_instance_id),
            reason: "claimed_stale_or_missing_lease",
        });
    };

    if current.owner_instance_id == identity.instance_id {
        let next = LeaseRecord::new(identity, now, lease_ttl, current.generation);
        write_record(file, &next)?;

        return Ok(OwnershipDecision {
            mode: OwnershipMode::Owner,
            owner_instance_id: Some(next.owner_instance_id),
            reason: "renewed_existing_lease",
        });
    }

    if should_preempt(identity, &current) {
        let generation = current.generation.saturating_add(1);
        let next = LeaseRecord::new(identity, now, lease_ttl, generation);
        write_record(file, &next)?;

        return Ok(OwnershipDecision {
            mode: OwnershipMode::Owner,
            owner_instance_id: Some(next.owner_instance_id),
            reason: "preempted_older_instance",
        });
    }

    Ok(OwnershipDecision {
        mode: OwnershipMode::Passive,
        owner_instance_id: Some(current.owner_instance_id),
        reason: "older_instance_kept_ownership",
    })
}

fn should_preempt(identity: &InstanceIdentity, current: &LeaseRecord) -> bool {
    if identity.started_at_ms > current.owner_started_at_ms {
        return true;
    }

    if identity.started_at_ms == current.owner_started_at_ms {
        return identity.instance_id > current.owner_instance_id;
    }

    false
}

fn is_record_active(record: &LeaseRecord, now: u64) -> bool {
    record.lease_until_ms > now && is_process_alive(record.owner_pid)
}

fn read_record(file: &mut File) -> Option<LeaseRecord> {
    if file.seek(SeekFrom::Start(0)).is_err() {
        return None;
    }

    let mut contents = String::new();
    if file.read_to_string(&mut contents).is_err() {
        return None;
    }

    let trimmed = contents.trim();
    if trimmed.is_empty() {
        return None;
    }

    serde_json::from_str(trimmed).ok()
}

fn write_record(file: &mut File, record: &LeaseRecord) -> Result<()> {
    let payload = serde_json::to_vec(record).context("failed to serialize lease record")?;

    file.seek(SeekFrom::Start(0))
        .context("failed to seek ownership state file")?;
    file.set_len(0)
        .context("failed to truncate ownership state file")?;
    file.write_all(&payload)
        .context("failed to write ownership state file")?;
    file.flush()
        .context("failed to flush ownership state file")?;
    file.sync_data()
        .context("failed to sync ownership state file")?;

    Ok(())
}

fn default_state_file_path() -> PathBuf {
    let runtime_dir = env::var("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let mut path = env::temp_dir();
            let user = env::var("USER").unwrap_or_else(|_| String::from("unknown"));
            path.push(format!("ozon-mcp-{user}"));
            path
        });

    runtime_dir.join("ozon-mcp-owner.json")
}

fn parse_u64_env(name: &str) -> Option<u64> {
    let value = env::var(name).ok()?;
    value.parse::<u64>().ok()
}

#[cfg(target_os = "linux")]
fn is_process_alive(pid: u32) -> bool {
    if pid == process::id() {
        return true;
    }

    PathBuf::from("/proc").join(pid.to_string()).exists()
}

#[cfg(not(target_os = "linux"))]
fn is_process_alive(pid: u32) -> bool {
    pid == process::id()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn now_ns() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}
