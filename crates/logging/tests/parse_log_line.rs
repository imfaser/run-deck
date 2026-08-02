use logging::parse_log_line;

#[test]
fn parses_normal_line() {
    let entry = parse_log_line("2026-08-02 12:34:56.789 INFO [module/foo] hello world")
        .expect("valid line should parse");
    assert_eq!(entry.ts, "2026-08-02 12:34:56.789");
    assert_eq!(entry.level, "info");
    assert_eq!(entry.message, "hello world");
}

#[test]
fn normalizes_level_to_lowercase() {
    let entry = parse_log_line("2026-08-02 12:34:56.789 WARN [bar] boom").unwrap();
    assert_eq!(entry.level, "warn");
}

#[test]
fn trims_whitespace_around_message() {
    let entry = parse_log_line("2026-08-02 12:34:56.789 ERROR [m]   padded msg  ").unwrap();
    assert_eq!(entry.message, "padded msg");
}

#[test]
fn message_may_be_empty() {
    let entry = parse_log_line("2026-08-02 12:34:56.789 INFO [m]").unwrap();
    assert_eq!(entry.message, "");
}

#[test]
fn rejects_empty_line() {
    assert_eq!(parse_log_line(""), None);
    assert_eq!(parse_log_line("   "), None);
}

#[test]
fn rejects_line_without_bracket() {
    assert_eq!(parse_log_line("2026-08-02 12:34:56.789 INFO just a message"), None);
}

#[test]
fn rejects_malformed_lines() {
    assert_eq!(parse_log_line("no-spaces-here"), None);
    assert_eq!(parse_log_line("2026-08-02 12:34:56.789"), None);
}
