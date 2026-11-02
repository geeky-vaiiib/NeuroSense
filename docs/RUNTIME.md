# Runtime and operations

Verified local platform: macOS arm64, Python 3.11.14, sklearn 1.6.1, XGBoost 2.1.4, torch 2.6.0, Node 25.9.0, npm 11.12.1. `backend/requirements.lock` resolves all transitive dependencies with hashes and platform markers; `package-lock.json` locks the frontend. `.python-version` / `.nvmrc` record the verification versions. Linux x86-64 CI/container configuration is prepared; execution in a Linux container is a separate unexecuted check until recorded in RELEASE_ACCEPTANCE.md. Linux PyPI torch includes large CUDA libraries even though inference here uses CPU; budget build disk/network accordingly. Dependency locking is not a vulnerability assessment or promise of ongoing support.

## Clean local setup (no real database required)

Install Python 3.11.14 and Node 25.9.0, then from the repository root:

```sh
python3.11 -m venv .venv
. .venv/bin/activate
python -m pip install --require-hashes -r backend/requirements.lock
npm ci
export NUMBA_CACHE_DIR="${TMPDIR:-/tmp}/neurosense-numba"
# Throw-away accounts/cases; no existing .env secrets or database are used by this script.
NEUROSENSE_PYTHON="$PWD/.venv/bin/python" bash scripts/dev_e2e_backend.sh 8000
```

In a second terminal: `npm run dev` and open `http://localhost:5173`. Use **the same hostname** for frontend and API: `localhost`/`localhost` or `127.0.0.1`/`127.0.0.1`. Mixing them is cross-site and SameSite=Lax cookies may be rejected. For the latter set `VITE_API_URL=http://127.0.0.1:8000`. The browser suite does this explicitly. In-memory storage is process-local, discarded on restart, and **must not** be used for multi-worker deployment.

For persistent local use, copy `backend/.env.example` to `backend/.env`, configure a dedicated local MongoDB database, and generate a random secret (command in example); run `python -m uvicorn backend.main:app --workers 1 --port 8000`. Never copy production credentials into tests. Missing/unsafe JWT or inaccessible database aborts startup. Optional artifact failures log category and exception and leave deterministic scoring available. Health JSON never returns connection strings or secret values.

## Verification

```sh
NUMBA_CACHE_DIR=/tmp/neurosense-numba PYTHONPATH=backend python -m pytest backend/tests -q
PYTHONPATH=backend python scripts/check_research_consistency.py
npm test
npm run lint
npm run build
npx playwright install chromium
NEUROSENSE_PYTHON="$PWD/.venv/bin/python" npm run test:e2e
```

`conftest.py` sets disposable configuration before imports, injects fresh mongomock per test and uses an isolated recording spool. E2E launches its own Vite/FastAPI servers; uses real auth/scoring/persistence against throw-away mongomock. Camera/OpenFace-unavailable responses and a single dropped submission response are controlled browser fixtures, not real recording coverage. Do not run against a production URL. CI repeats these checks without service credentials. Raw DASD tests skip when licensed local data are absent; inspect skip counts. Q-CHAT SAV included in this checkout is required for consistency audit, subject to its attribution terms.

## Artifact compatibility

Shipped sklearn pickle metadata records 1.6.1; adult XGBoost serialized buffers record 2.1.4. Old pins were 1.5.2 / 2.1.1. Corrected runtime loads both bundles without compatibility warnings. Eleven fixed item totals per track have identical predictions across old/new environments (see evidence JSON). No pickle was rewritten or model retrained. Loader treats sklearn/serialization compatibility warnings as unavailability; this is deliberate rejection, not warning suppression. A missing/corrupt explanation background affects explanation availability separately. Only trusted bundled model files may be deserialized; arbitrary uploaded pickle files are never accepted.

## Gaze lifecycle and concurrency

* `submit` inserts durable `processing` state, random owner token, heartbeat timestamp, **60-second lease**, **15-minute deadline**, before starting its thread. Heartbeat runs every 10 seconds including queue wait. MongoDB must be reachable; there is no in-memory success fallback.
* Any worker polls the shared owner-scoped document. A local cache miss has no lifecycle meaning. Polling/admission recovers expired leases (`interrupted`) or deadlines (`job_timeout`) with explicit unavailable output. Legacy processing documents without leases receive their remaining original 15-minute deadline; they are not failed on a cache miss.
* Stage/heartbeat/completion updates require the correct token, processing state and unexpired lease/deadline. Recovery compares the observed lease/deadline, so concurrent renewal cannot be overwritten. Terminal states are immutable to late completion. No lease takeover/re-execution is performed; retry is a new recording job.
* Timeouts end acceptance of results, **not computation**. Browser polling stops after 10 minutes; backend deadline is 15 minutes. Native subprocesses may have their own time limits. The thread/semaphore slot and raw file may remain until computation actually returns. A hung native call may require operator process termination.
* Shared MongoDB state, ownership and compare-and-set transitions apply across processes. Per-user admission count + insert is serialized **within one process only**; cross-process submissions can overshoot the cap. The two-run OpenFace semaphore and authentication throttles are **per process**. Use **one application worker/instance** until admission/throttles/resource scheduling use a shared atomic mechanism or queue. These are not distributed concurrency guarantees.
* Threads are daemon workers, not a durable work queue. Shutdown waits up to five seconds, then stops accepting persistence with process exit; unfinished jobs expire by lease. A polling/admission call performs recovery (there is no always-on distributed sweeper). MongoDB TTL removes job records after two hours; references may no longer resolve after expiry. Completed case records retain their copied analysis and provenance.

## Temporary files and recovery

`NS_RECORDING_TMP_DIR` is a private application-owned spool (default OS temp/neurosense-recordings). Uploads delete raw files after success/failure and rejected submissions; normalization uses a TemporaryDirectory. Audio decode files also delete in `finally`. Do not use this directory for user assets. Hard process termination can leave files: startup removes only known-prefix entries older than two hours, protects raw paths with live durable leases, ignores symlinks/unrelated names, and logs the count. This does not cancel running work. Crash leftovers can persist until the next startup; use an operator scheduled sweep in a running, configured process if stricter deletion timing is required. Avoid deleting live files manually. The old pre-spool system-temp files require a deliberate operator inventory; startup does not scan arbitrary system temp directories. Disk encryption, backups, file permissions, and retention policy still need deployment approval.

## Deployment configuration (prepared, not deployed)

`deploy/Dockerfile.backend`: Python 3.11.14, hash-locked dependencies, FFmpeg/libgomp, unprivileged UID 10001, one worker. Build with `docker build -f deploy/Dockerfile.backend -t neurosense-research .`; supply environment at run time, never build secrets into the image. `.dockerignore` excludes environment files, local records, raw external data, caches and quarantined models. Base OS package/image digests have not been frozen or security certified; rebuild verification is required before deployment.

`deploy/nginx.conf.example` illustrates TLS termination, static SPA fallback, API proxy and 160 MB upload cap. Replace hostnames/certificate paths. Build frontend with the intended HTTPS API origin. Keep backend private; allow only the exact frontend HTTPS origin, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax` for same-site subdomains. Cross-site origins require `none` + secure and browser third-party-cookie compatibility; prefer same-site hosting. Do not use wildcard CORS. Cookie-authenticated writes require the custom CSRF header. Restrict trusted proxy/IP forwarding before relying on process-local per-client throttles. TLS, database authentication/network rules, backups, access audit, participant consent and deletion policies need operator review.

MongoDB: durable shared database with unique case/user/JTI/job/submission indexes and job/revocation TTLs; use dedicated research credentials with only needed access, not production credentials. `/live` checks process responsiveness; `/ready` returns 200 for core DB availability or 503 when disconnected. `/` details real optional capabilities; unavailable model/OpenFace does not fail core readiness. Readiness does not imply research validity.

OpenFace: optional external FeatureExtraction 2.x binary via `OPENFACE_BIN`, or `algebr/openface` amd64 image. `ffmpeg` / `ffprobe` are needed for video normalization and typical browser audio decoding. Recommended OpenFace host: Linux x86-64, CPU, writable private temp storage; Apple silicon may require Docker amd64 emulation and has not been benchmarked here. The supplied backend image does **not** install OpenFace or mount a Docker socket. Install a native trusted binary or arrange an explicitly reviewed isolation boundary; do not expose a privileged Docker socket casually. Pin and test the actual OpenFace image digest/binary version before research collection. Budget at least 4 CPU cores, 8 GB RAM plus upload/temp storage as an **initial unverified sizing assumption**; measure two concurrent maximum recordings before choosing resources. Default warmup disabled in tests; use `GAZE_WARMUP=0` when unavailable.

## Troubleshooting

* Speech `cannot cache function`: set writable `NUMBA_CACHE_DIR`; do not turn the failure into a synthetic score.
* Optional models unavailable: confirm locked Python/runtime, artifact hashes and startup logs; retain score-only capability if artifacts are missing. Replacing models requires documented evaluation.
* Session immediately expires: align browser/API hostname, CORS origins, secure cookie and HTTPS. No token belongs in localStorage.
* Job interrupted/timeout: inspect durable lease/deadline, DB connectivity and worker logs. The status does not prove native processing stopped. New job submission requires an explicit retry; duplicate screening retry keys preserve a saved case.
* Submission timeout: UI retains answers in the mounted flow and reuses `Idempotency-Key` for an identical request. MongoDB owner/key unique index atomically stores one case + exact response. Concurrent duplicate processing may occur but one case wins. Different request with reused key returns 409. Keys have no TTL. Clients without a key retain legacy non-idempotent behavior. Draft/key state does not survive leaving/reloading the unsaved flow; deliberately repeated fresh screenings are distinct cases.

Final review additions: synchronous screening/measurement and explanation endpoints run in FastAPI's thread pool to keep the event loop responsive during model work. This is bounded by the server thread pool and does not make CPU/RAM unbounded concurrency safe. Browser acceptance found the child explanation could otherwise delay `/auth/me` after refresh. A controlled slow-explanation regression now verifies session restoration remains responsive. Non-breaking npm advisory remediation updated the lock (including Axios, Vite, Vitest and transitive DOMPurify). Six moderate ESLint/minimatch development-toolchain findings remain in npm audit; no force downgrade or security-clean claim is made. Never expose Vite/Vitest development servers to untrusted networks.
