# Wappler Bull Queues

## Overview
Wappler Bull Queues enables the creation and management of multiple queues to offload and control the execution of Wappler library tasks using [Bull](https://github.com/OptimalBits/bull) and Redis.

---

## Requirements
- A working Redis connection, specified in the Wappler server config or via environment variables.

---

## Optional Environment Variables
| Variable                  | Description                                                                                 |
|---------------------------|---------------------------------------------------------------------------------------------|
| `REDIS_PORT`              | The Redis port                                                                              |
| `REDIS_HOST`              | The Redis host                                                                              |
| `REDIS_BULL_QUEUE_DB`     | The Redis database for bull queues                                                          |
| `REDIS_PASSWORD`          | The Redis password                                                                          |
| `REDIS_USER`              | The Redis user                                                                              |
| `REDIS_TLS`               | TLS certificate. Use `{}` for TLS without a cert                                            |
| `REDIS_PREFIX`            | Prefix for the database (useful for clusters)                                               |
| `REDIS_BULL_METRICS`      | Enables Bull metrics collection (Boolean)                                                    |
| `REDIS_BULL_METRICS_TIME` | Timeframe for metric collection (default: `TWO_WEEKS`)                                      |
| `BULL_LOGS_INDEX`         | Index name for bull logs (e.g., `nodejs-logs`, suffixed with `-${year}.${month}`)           |

---

## Actions

### Configure Logging
Supports three types of logging with levels: `error`, `warn`, `info`, `debug`. Logging is configured globally for all Bull queue actions.

1. **Console**
   - Always on, defaults to `error`.
2. **File**
   - Enabled by specifying a log level.
   - Disabled with `none` or empty.
   - Daily rotated logs in `/logs`, keeps 14 days.
3. **Bull** (for Bull Board UI)
   - Enabled with `true`, disabled with `false`.
4. **OpenSearch** (optional)
   - Enabled with `true` and required ENV variables, disabled with `false`.

---

### Create Queue
- Creates a queue with optional parameters.
- Responds with a message indicating the result.

**Queue Parameters:**
- **Queue name**: Unique identifier for the queue.
- **Number of concurrent jobs**: How many jobs run in parallel (default: 5).
- **Max jobs**: Maximum jobs in a given duration.
- **Duration for max jobs**: Milliseconds for rate limiting.
- **Processor type**: `'library'` (default) or `'api'`.

**Rate Limiting Example:**
> To limit to 1 request per second, set Max jobs = 1, Duration = 1000.

---

### Pause/Resume Queue
- **Pause Queue**: Pauses processing of jobs in the specified queue. Jobs remain in the queue and will resume when resumed.
- **Resume Queue**: Resumes processing of jobs in the specified queue.

---

### Add Job
- Adds a job to a queue.
- Executes the specified Library File, passing the provided parameters.
- The job ID is available in the library as `$_PARAM.id`.
- Supports queue creation with default parameters, job delay, and auto-removal on completion.
- Responds with the job ID.

> **Note:** The Add Job action does not work if executed from a previously submitted job (nested jobs). Use Add Job API for such cases.

#### Advanced Job Options
| Option                | Description                                                      |
|-----------------------|------------------------------------------------------------------|
| `remove_on_complete`  | Remove job from queue when completed (boolean or number)          |
| `keep_completed_jobs` | Alternative to above                                             |
| `remove_on_fail`      | Remove job from queue when failed (boolean or number)             |
| `keep_failed_jobs`    | Alternative to above                                             |
| `attempts`            | Number of retry attempts (integer)                               |
| `attempts_delay`      | Delay between attempts in ms (integer)                           |
| `backoff_type`        | `'fixed'` or `'exponential'` (string)                            |
| `priority`            | Job priority (integer)                                           |
| `repeatable`          | Whether the job should repeat (boolean)                          |
| `repeat_interval`     | Repeat interval in ms (integer)                                  |
| `repeat_limit`        | Max number of repeats (integer)                                  |
| `repeat_pattern`      | Cron pattern for repeat (string)                                 |

---

### Add Job API
- Adds a job to a queue, executing the specified API File with POST values.
- The job ID is available as `$_POST.id`.
- Supports all advanced job options as above.
- Responds with the job ID.

---

### Retry Job
- Resubmits a job for processing by job ID.

---

### Queue Status
- Returns job counts for the specified queue (active, completed, waiting, delayed, etc.).

---

### Queue Clean
- Removes jobs from a queue by job status.
- Optionally set a grace period to retain newer jobs while deleting old ones.
- **Job status choices:** Completed, Delayed, Failed (Active jobs cannot be removed; Waiting not supported by Bull).

---

### Job State
- Returns job details and current status for a given job ID.

---

### Get Jobs
- Retrieve jobs by status from a specified queue.
- **Job status choices:** Active, Failed, Waiting, Delayed, Completed.

---

### Get All Jobs
- Retrieve jobs by status from multiple queues at once.
- Specify a comma-separated list of queue names.
- **Job status choices:** Active, Failed, Waiting, Delayed, Completed, All.

---

### Repeatable Jobs
- **Get Repeatable Jobs**: List all repeatable jobs for a queue.
- **Remove Repeatable Job**: Remove a repeatable job from a queue by name.

---

### Destroy Queue
- Forcefully destroys a given queue.
- Removes all jobs from the queue (running jobs will complete).
- Resets the job ID back to 1.


