# Dhanam Monitoring Stack

> [!IMPORTANT]
> MADFAM-ENCLII-FIRST-LEGACY-RAW v1: This document contains legacy raw infrastructure command examples.
> Routine production operations must use Enclii web, API, or CLI. Treat raw
> `kubectl`, `helm`, SSH, provider CLI/API, `docker exec`, and direct container
> access as platform bootstrap or documented break-glass only, and record any
> missing Enclii adapter gap.

Kubernetes manifests for Prometheus, Alertmanager, and Grafana on the Dhanam cluster.

## Contents

| File                                 | Purpose                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `namespace.yaml`                     | `dhanam-monitoring` namespace                                                     |
| `service-monitors.yaml`              | ServiceMonitor CRDs — scrapes `/metrics` on port 4300                             |
| `prometheus-rules.yaml`              | PrometheusRule CRD — alert rules for API, DB, Redis, queues                       |
| `alertmanager-config.yaml`           | Alertmanager K8s Secret with routing and receiver config                          |
| `alertmanager-secrets-template.yaml` | Template for `alertmanager-webhook-secrets` Secret (Slack/PagerDuty URLs)         |
| `grafana-dashboards-configmap.yaml`  | Auto-provisioned Grafana dashboards (request rate, error rate, p95 latency, etc.) |
| `synthetic-cronjob.yaml`             | CronJob (every 5 min) that hits API and Web health endpoints                      |
| `kustomization.yaml`                 | Kustomize entrypoint for the monitoring overlay                                   |

## Alert Routing

| Severity | Channel                   | Repeat Interval | Examples                                       |
| -------- | ------------------------- | --------------- | ---------------------------------------------- |
| critical | `#dhanam-alerts-critical` | 1 hour          | Pod crashes, DB down, auth failure spikes      |
| warning  | `#dhanam-alerts`          | 12 hours        | High p95 latency, queue depth, memory pressure |

Critical alerts inhibit matching warning alerts (same alertname + namespace).

## Slack Webhook Setup

1. Go to https://api.slack.com/apps and create (or select) an app.
2. Enable **Incoming Webhooks** under Features.
3. Click **Add New Webhook to Workspace**, select `#dhanam-alerts-critical`, and copy the URL.
4. Repeat for `#dhanam-alerts`.
5. Each URL looks like: `https://hooks.slack.com/services/T.../B.../xxx`

## Deployment

1. Copy `alertmanager-secrets-template.yaml` to `alertmanager-secrets.yaml`.
2. Replace all `REPLACE_WITH_*` values in the copy with real webhook URLs:
   - `SLACK_CRITICAL_WEBHOOK_URL` -- critical channel webhook
   - `SLACK_WARNING_WEBHOOK_URL` -- warning channel webhook
   - (Optional) Uncomment `PAGERDUTY_SERVICE_KEY` and fill in the integration key
3. Apply the webhook secrets first, then the rest:

```bash
kubectl apply -f infra/k8s/monitoring/alertmanager-secrets.yaml
kubectl apply -k infra/k8s/monitoring/
```

4. Mount the `alertmanager-webhook-secrets` Secret into your Alertmanager pod at
   `/etc/alertmanager/secrets/` (see comments in `alertmanager-config.yaml` for the
   volume mount snippet).

## Synthetic Health Checks

A CronJob (`dhanam-synthetic-healthcheck`) runs every 5 minutes in the `dhanam`
namespace. It curls the API and Web health endpoints and exits non-zero on failure.
Failed jobs surface via `kube_job_status_failed` metrics, which Alertmanager can
pick up through existing PodRestart/Job alert rules.
