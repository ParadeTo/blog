# Xiaoquanv2 Langfuse Local

Start:

```bash
cd demo/xiaoquanv2/infra
podman compose -f langfuse-podman-compose.yaml up -d
```

Open:

```text
http://localhost:3010
```

The compose file initializes a local project. Export those local demo keys:

```bash
export TRACE_TO_LANGFUSE=true
export XIAOQUAN_LANGFUSE_BASE_URL=http://localhost:3010
export XIAOQUAN_LANGFUSE_PUBLIC_KEY=pk-lf-xiaoquanv2-local
export XIAOQUAN_LANGFUSE_SECRET_KEY=sk-lf-xiaoquanv2-local
```

Stop:

```bash
podman compose -f langfuse-podman-compose.yaml down
```

Remove local data:

```bash
podman compose -f langfuse-podman-compose.yaml down -v
```

This is local demo infrastructure. It does not provide high availability, backups, or production Secret Manager integration.
