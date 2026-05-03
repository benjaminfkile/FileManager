# grunt API — Examples

Runnable `curl` recipes. The base URL is `http://192.168.50.30:5173` and there are no auth headers.

## Health check before doing anything

```sh
curl -s http://192.168.50.30:5173/api/health | jq
```

Look for `status: "ok"`. Then sanity-check the runtime:

```sh
curl -s http://192.168.50.30:5173/api/system/docker        | jq
curl -s http://192.168.50.30:5173/api/system/runner-image  | jq
curl -s http://192.168.50.30:5173/api/system/capped        | jq
curl -s http://192.168.50.30:5173/api/system/worker-status | jq
```

If `docker.available` is false, `runner-image.status` is `"building"`/`"error"`, `capped.capped` is true, or `worker-status.mode !== "worker"`, posted tasks will sit in `pending`.

## Find or register a repo

List existing:

```sh
curl -s http://192.168.50.30:5173/api/repos | jq
```

Register a new git-backed repo (clones synchronously):

```sh
curl -s -X POST http://192.168.50.30:5173/api/repos \
  -H 'Content-Type: application/json' \
  -d '{
    "owner": "myorg",
    "repo_name": "myservice",
    "base_branch": "main",
    "require_pr": true
  }' | jq
```

Register a local-folder repo (no git, no PR):

```sh
curl -s -X POST http://192.168.50.30:5173/api/repos \
  -H 'Content-Type: application/json' \
  -d '{
    "is_local_folder": true,
    "local_path": "C:/Users/Ben/dev/repos/myservice"
  }' | jq
```

Re-clone a repo that errored:

```sh
curl -s -X POST http://192.168.50.30:5173/api/repos/12/clone | jq
```

## Post a single task

```sh
curl -s -X POST http://192.168.50.30:5173/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "repo_id": 12,
    "title": "Add /healthz endpoint",
    "description": "Add a GET /healthz route that returns {status:\"ok\"}. The route should be registered in src/app.ts and live in src/routers/healthRouter.ts.",
    "acceptanceCriteria": [
      "Returns 200 with body {\"status\":\"ok\"}",
      "Has a unit test in __tests__/health.test.ts",
      "Lints clean"
    ]
  }' | jq
```

The response includes the new task id — use it for everything downstream.

## Post a parent + children atomically

```sh
curl -s -X POST http://192.168.50.30:5173/api/repos/12/materialize-tree \
  -H 'Content-Type: application/json' \
  -d '{
    "parents": [
      {
        "title": "Migrate auth to OIDC",
        "description": "Replace the legacy session middleware with an OIDC adapter.",
        "acceptance_criteria": [
          "Login flow works against the staging IdP",
          "Existing /me endpoint still returns user payload"
        ],
        "children": [
          {
            "title": "Add OIDC adapter module",
            "description": "Create src/auth/oidcAdapter.ts.",
            "acceptance_criteria": [
              "Module exposes verifyIdToken() and getUserInfo()"
            ]
          },
          {
            "title": "Swap middleware in app.ts",
            "description": "Wire the new adapter into the request pipeline.",
            "acceptance_criteria": [
              "Old middleware is deleted",
              "Existing auth tests still pass"
            ]
          }
        ]
      }
    ]
  }' | jq
```

## Watch a task

Poll status:

```sh
curl -s http://192.168.50.30:5173/api/tasks/42 | jq '{status, retry_count, pr_url}'
```

Read the saved log (404 until first byte):

```sh
curl -s http://192.168.50.30:5173/api/tasks/42/log
```

Stream the log via SSE while the task is active (server closes the stream on terminal state):

```sh
curl -N http://192.168.50.30:5173/api/tasks/42/log/stream
```

Read the event timeline:

```sh
curl -s http://192.168.50.30:5173/api/tasks/42/events | jq
```

Token usage for the task:

```sh
curl -s http://192.168.50.30:5173/api/tasks/42/usage | jq
```

## Mark a criterion satisfied

```sh
curl -s -X PATCH http://192.168.50.30:5173/api/tasks/42/criteria/101 \
  -H 'Content-Type: application/json' \
  -d '{"met": true}' | jq
```

## Add context for the agent via a note

A user-authored note visible to all tasks in the repo:

```sh
curl -s -X POST http://192.168.50.30:5173/api/tasks/42/notes \
  -H 'Content-Type: application/json' \
  -d '{
    "author": "user",
    "visibility": "all",
    "content": "Use the existing logger at src/util/logger.ts; do not introduce a new one.",
    "tags": ["convention", "logging"]
  }' | jq
```

A note scoped to descendants only — useful when the parent has guidance for its children:

```sh
curl -s -X POST http://192.168.50.30:5173/api/tasks/42/notes \
  -H 'Content-Type: application/json' \
  -d '{
    "author": "user",
    "visibility": "descendants",
    "content": "All sub-tasks should target the OIDC adapter at src/auth/oidcAdapter.ts."
  }' | jq
```

## Pause / approve a gated task

Create a task that won't auto-run:

```sh
curl -s -X POST http://192.168.50.30:5173/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "repo_id": 12,
    "title": "Run the schema migration",
    "description": "Apply migrations/20260501_add_audit.sql.",
    "requires_approval": true
  }' | jq
```

Release it for the scheduler:

```sh
curl -s -X PATCH http://192.168.50.30:5173/api/tasks/77 \
  -H 'Content-Type: application/json' \
  -d '{"requires_approval": false}' | jq
```

## Override the model for a task

```sh
curl -s -X PATCH http://192.168.50.30:5173/api/tasks/42 \
  -H 'Content-Type: application/json' \
  -d '{"model": "claude-opus-4-7"}' | jq

curl -s http://192.168.50.30:5173/api/tasks/42/effective-model | jq
```

The `effective-model` endpoint also tells you *where* the model came from (override / parent / default).

## Register a Slack-compatible webhook

```sh
curl -s -X POST http://192.168.50.30:5173/api/repos/12/webhooks \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://hooks.slack.com/services/T000/B000/XXX",
    "events": ["done", "failed"],
    "active": true
  }' | jq
```

## Save and replay a template

Capture the current tree under a repo:

```sh
curl -s -X POST http://192.168.50.30:5173/api/templates \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "service-bootstrap",
    "description": "Standard scaffold for a new service",
    "repo_id": 12
  }' | jq
```

Replay it into another repo:

```sh
curl -s -X POST http://192.168.50.30:5173/api/repos/19/instantiate-template/3 | jq
```

## A complete poll-to-done loop (bash)

```sh
TASK_ID=$(curl -s -X POST http://192.168.50.30:5173/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "repo_id": 12,
    "title": "Add /healthz endpoint",
    "description": "GET /healthz returns {status:\"ok\"}.",
    "acceptanceCriteria": ["Returns 200", "Has a unit test"]
  }' | jq -r '.id')

while :; do
  STATUS=$(curl -s "http://192.168.50.30:5173/api/tasks/$TASK_ID" | jq -r '.status')
  echo "task $TASK_ID: $STATUS"
  case "$STATUS" in
    done|failed) break ;;
  esac
  sleep 10
done

curl -s "http://192.168.50.30:5173/api/tasks/$TASK_ID" | jq
```

## A complete poll-to-done loop (PowerShell)

```powershell
$body = @{
  repo_id = 12
  title = "Add /healthz endpoint"
  description = "GET /healthz returns {status:'ok'}."
  acceptanceCriteria = @("Returns 200", "Has a unit test")
} | ConvertTo-Json

$task = Invoke-RestMethod -Method Post `
  -Uri http://192.168.50.30:5173/api/tasks `
  -ContentType application/json `
  -Body $body

while ($true) {
  $t = Invoke-RestMethod -Uri "http://192.168.50.30:5173/api/tasks/$($task.id)"
  Write-Host "task $($task.id): $($t.status)"
  if ($t.status -in @("done", "failed")) { break }
  Start-Sleep -Seconds 10
}

Invoke-RestMethod -Uri "http://192.168.50.30:5173/api/tasks/$($task.id)" | ConvertTo-Json -Depth 6
```
