# Security

Code Remote Starter launches Claude Code with `--dangerously-skip-permissions`, so the access
token is the only thing protecting it. Keep the token private and reach the app over a trusted
network (your LAN, Tailscale, or a token-protected tunnel). The app also locks out an IP after
repeated wrong-token attempts.

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue — open a
[GitHub security advisory](https://github.com/burakgon/code-remote-starter/security/advisories/new).
We'll respond as soon as we can.
