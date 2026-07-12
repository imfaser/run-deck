use serde::{Deserialize, Serialize};

/// Shell 类型枚举
///
/// 用于指定 MCP 服务器启动时使用的 shell 环境。
/// 用户可以显式选择 shell 类型，或使用 `Auto` 让库自动检测平台默认 shell。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ShellType {
    /// 自动检测平台默认 shell
    /// Windows 上使用 Cmd，Linux/macOS 上使用 Bash
    Auto,
    /// Windows cmd.exe
    Cmd,
    /// PowerShell (pwsh/powershell)
    PowerShell,
    /// Bash shell
    Bash,
}

impl ShellType {
    /// 获取当前平台的默认 shell 类型
    ///
    /// - Windows 上默认使用 Cmd
    /// - Linux/macOS 上默认使用 Bash
    pub fn default_for_platform() -> Self {
        if cfg!(windows) {
            ShellType::Cmd
        } else {
            ShellType::Bash
        }
    }

    /// 解析 Auto 类型为实际的 shell 类型
    ///
    /// 如果是 Auto，返回当前平台的默认 shell；
    /// 否则返回自身。
    pub fn resolve(&self) -> Self {
        match self {
            ShellType::Auto => Self::default_for_platform(),
            other => other.clone(),
        }
    }

    /// 获取 shell 可执行文件名
    pub fn executable(&self) -> &'static str {
        match self {
            ShellType::Cmd => "cmd",
            ShellType::PowerShell => "powershell",
            ShellType::Bash => "bash",
            ShellType::Auto => Self::default_for_platform().executable(),
        }
    }

    /// 获取 shell 的命令执行参数
    ///
    /// 返回 shell 启动时需要的额外参数（不包含 shell 可执行文件和命令本身）
    pub fn shell_args(&self) -> Vec<&'static str> {
        match self {
            ShellType::Cmd => vec!["/c"],
            ShellType::PowerShell => vec!["-NoProfile", "-Command"],
            ShellType::Bash => vec!["-c"],
            ShellType::Auto => Self::default_for_platform().shell_args(),
        }
    }

    /// 是否需要将命令用引号包裹
    pub fn needs_quoting(&self) -> bool {
        match self {
            ShellType::Cmd => false,
            ShellType::PowerShell => false,  // PowerShell 不需要引号
            ShellType::Bash => true,
            ShellType::Auto => Self::default_for_platform().needs_quoting(),
        }
    }
}

impl Default for ShellType {
    fn default() -> Self {
        ShellType::Auto
    }
}

/// 将命令包装为 shell 执行格式
///
/// # Arguments
/// * `shell` - Shell 类型
/// * `command` - 用户配置的命令（如 `["npx", "-y", "server"]`）
///
/// # Returns
/// 包装后的命令参数列表（如 `["cmd", "/c", "npx", "-y", "server"]`）
///
/// # Example
/// ```
/// use mcp::shell::{ShellType, wrap_command};
///
/// let cmd = vec!["npx".to_string(), "-y".to_string(), "server".to_string()];
/// let wrapped = wrap_command(&ShellType::Cmd, &cmd);
/// assert_eq!(wrapped, vec!["cmd", "/c", "npx", "-y", "server"]);
/// ```
pub fn wrap_command(shell: &ShellType, command: &[String]) -> Vec<String> {
    if command.is_empty() {
        return vec![];
    }

    let resolved = shell.resolve();
    let exe = resolved.executable();
    let args = resolved.shell_args();
    let needs_quoting = resolved.needs_quoting();

    let command_str = command.join(" ");

    let mut result = vec![exe.to_string()];
    result.extend(args.iter().map(|s| s.to_string()));

    if needs_quoting {
        result.push(format!("\"{command_str}\""));
    } else {
        result.extend(command.iter().cloned());
    }

    result
}
