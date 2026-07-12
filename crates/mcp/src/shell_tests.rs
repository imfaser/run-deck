use super::shell::{ShellType, wrap_command};
use pretty_assertions::assert_eq;

#[test]
fn shell_type_serialization() {
    assert_eq!(serde_json::to_string(&ShellType::Auto).unwrap(), "\"auto\"");
    assert_eq!(serde_json::to_string(&ShellType::Cmd).unwrap(), "\"cmd\"");
    assert_eq!(
        serde_json::to_string(&ShellType::PowerShell).unwrap(),
        "\"powershell\""
    );
    assert_eq!(serde_json::to_string(&ShellType::Bash).unwrap(), "\"bash\"");
}

#[test]
fn shell_type_deserialization() {
    assert_eq!(
        serde_json::from_str::<ShellType>("\"auto\"").unwrap(),
        ShellType::Auto
    );
    assert_eq!(
        serde_json::from_str::<ShellType>("\"cmd\"").unwrap(),
        ShellType::Cmd
    );
    assert_eq!(
        serde_json::from_str::<ShellType>("\"powershell\"").unwrap(),
        ShellType::PowerShell
    );
    assert_eq!(
        serde_json::from_str::<ShellType>("\"bash\"").unwrap(),
        ShellType::Bash
    );
}

#[test]
fn shell_type_default_is_auto() {
    assert_eq!(ShellType::default(), ShellType::Auto);
}

#[test]
fn shell_type_resolve_auto() {
    let resolved = ShellType::Auto.resolve();
    if cfg!(windows) {
        assert_eq!(resolved, ShellType::Cmd);
    } else {
        assert_eq!(resolved, ShellType::Bash);
    }
}

#[test]
fn shell_type_resolve_explicit() {
    assert_eq!(ShellType::Cmd.resolve(), ShellType::Cmd);
    assert_eq!(ShellType::PowerShell.resolve(), ShellType::PowerShell);
    assert_eq!(ShellType::Bash.resolve(), ShellType::Bash);
}

#[test]
fn wrap_command_empty() {
    let cmd: Vec<String> = vec![];
    let wrapped = wrap_command(&ShellType::Cmd, &cmd);
    assert!(wrapped.is_empty());
}

#[test]
fn wrap_command_cmd() {
    let cmd = vec![
        "npx".to_string(),
        "-y".to_string(),
        "server-everything".to_string(),
    ];
    let wrapped = wrap_command(&ShellType::Cmd, &cmd);
    assert_eq!(
        wrapped,
        vec![
            "cmd".to_string(),
            "/c".to_string(),
            "npx".to_string(),
            "-y".to_string(),
            "server-everything".to_string(),
        ]
    );
}

#[test]
fn wrap_command_powershell() {
    let cmd = vec![
        "npx".to_string(),
        "-y".to_string(),
        "server-everything".to_string(),
    ];
    let wrapped = wrap_command(&ShellType::PowerShell, &cmd);
    assert_eq!(
        wrapped,
        vec![
            "powershell".to_string(),
            "-NoProfile".to_string(),
            "-Command".to_string(),
            "npx".to_string(),
            "-y".to_string(),
            "server-everything".to_string(),
        ]
    );
}

#[test]
fn wrap_command_bash() {
    let cmd = vec![
        "npx".to_string(),
        "-y".to_string(),
        "server-everything".to_string(),
    ];
    let wrapped = wrap_command(&ShellType::Bash, &cmd);
    assert_eq!(
        wrapped,
        vec![
            "bash".to_string(),
            "-c".to_string(),
            "\"npx -y server-everything\"".to_string(),
        ]
    );
}

#[test]
fn wrap_command_auto_windows() {
    let cmd = vec!["echo".to_string(), "hello".to_string()];
    let wrapped = wrap_command(&ShellType::Auto, &cmd);
    if cfg!(windows) {
        assert_eq!(
            wrapped,
            vec![
                "cmd".to_string(),
                "/c".to_string(),
                "echo".to_string(),
                "hello".to_string(),
            ]
        );
    } else {
        assert_eq!(
            wrapped,
            vec![
                "bash".to_string(),
                "-c".to_string(),
                "\"echo hello\"".to_string(),
            ]
        );
    }
}
