# Resource Safety

This repository is operated on a live, two-core host. Preserve capacity for
Nginx, the API, and the database.

- Do not start `npm start`, `react-scripts start`, or any other development
  server on this host. The public frontend is served by Nginx from static
  assets.
- Run Godot, browser, APK, build, and other CPU- or I/O-intensive commands via
  `scripts/run-bounded-task.sh <command>`. Its defaults reserve host capacity,
  impose a timeout, and remove all child processes when the scope ends.
- Do not background heavy commands. Wait for completion and verify that they
  did not leave a listener or child process behind.
- For a task that needs more than the runner's default budget, request explicit
  approval before increasing `SHOPTEST_TASK_TIMEOUT`, `SHOPTEST_TASK_CPU`, or
  `SHOPTEST_TASK_MEMORY`.
