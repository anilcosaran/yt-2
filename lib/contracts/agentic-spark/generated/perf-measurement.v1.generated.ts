// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/perf-measurement/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/perf-measurement/v1/common.schema.json",
    "title": "perf_measurement_common_v1",
    "description": "Shared definitions of the perf-measurement v1 package (P07-13 first slice: the target device, tenant/actor and project fixtures, the frozen thresholds and how a measurement run is recorded). Not a standalone document type. Hashes and timestamps are owned by assistant-runtime v1.",
    "$defs": {
      "ProfileId": {
        "description": "Kebab-case id of a versioned definition (device profile, fixture, mix, thresholds, plan, run).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]{2,63}$"
      },
      "Revision": {
        "type": "integer",
        "minimum": 1
      },
      "VersionedRef": {
        "description": "Exact revision of a definition. A definition revision is immutable: a change is a new revision with a reason.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "revision"
        ],
        "properties": {
          "id": {
            "$ref": "#/$defs/ProfileId"
          },
          "revision": {
            "$ref": "#/$defs/Revision"
          }
        }
      },
      "MetricId": {
        "description": "surface.name[.qualifier...]: lower snake_case segments separated by dots.",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*){1,3}$"
      },
      "KScenario": {
        "type": "string",
        "pattern": "^K[0-9]{2,3}[a-z]?$"
      },
      "Surface": {
        "description": "Where a metric is observed: the Spark editor client, Storage delivery, the platform catalog, the username service, Community moderation/egress, or the durable request API.",
        "enum": [
          "editor",
          "delivery",
          "catalog",
          "username",
          "community",
          "api",
          "worker"
        ]
      },
      "Unit": {
        "enum": [
          "ms",
          "s",
          "bytes",
          "mib",
          "megapixels",
          "count",
          "ratio",
          "percent",
          "percent_per_hour",
          "queries_per_request"
        ]
      },
      "Statistic": {
        "description": "p50/p95/p99 are nearest-rank percentiles of the samples; max/min are extremes; count is the number of events; ratio is a share in [0,1]; growth is the per-hour relative growth of a soak series.",
        "enum": [
          "p50",
          "p95",
          "p99",
          "max",
          "min",
          "count",
          "ratio",
          "growth"
        ]
      },
      "Temperature": {
        "description": "cold: no client or server cache state of the fixture; warm: after the protocol warm-up; soak: continuous interaction over the soak window.",
        "enum": [
          "cold",
          "warm",
          "soak"
        ]
      },
      "TemperatureOrAny": {
        "enum": [
          "cold",
          "warm",
          "soak",
          "any"
        ]
      },
      "Operator": {
        "enum": [
          "<=",
          ">=",
          "=="
        ]
      },
      "SourceKind": {
        "description": "prometheus: an existing exported series (its name is checked against the metric sources); harness: a client or test-harness measurement (performance marks, DevTools, a request spy); not_instrumented: nothing measures it yet and the instrumentation gap is named, so a run that needs it can only record not_measured.",
        "enum": [
          "prometheus",
          "harness",
          "not_instrumented"
        ]
      },
      "Basis": {
        "description": "Where a frozen number comes from. plan_candidate: written in the plan documents as a candidate; exact_requirement: a decision states the exact value (0 or 1); agent_proposed_candidate: proposed by the implementation slice before any measurement and awaiting owner confirmation. None of them is a measured result.",
        "enum": [
          "plan_candidate",
          "exact_requirement",
          "agent_proposed_candidate"
        ]
      },
      "AssetKind": {
        "enum": [
          "image",
          "gif",
          "video",
          "audio"
        ]
      },
      "LayerKind": {
        "enum": [
          "text",
          "shape",
          "clip",
          "motion_instance"
        ]
      },
      "Sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "Timestamp": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "perf-actor-fixture.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/perf-measurement/v1/perf-actor-fixture.schema.json",
    "title": "perf_actor_fixture_v1",
    "description": "A tenant/actor fixture of the measurement runs (FAZ-07 P07-13: hedef tenant/actor fixture'lari). It names the synthetic population and the platform-wide volumes a run needs (personal library, project mixes, catalog, Community, usernames) and the load shape. The population is seeded and synthetic: never production data (Q102), never a real account.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "fixture_id",
      "fixture_revision",
      "purpose",
      "k_scenarios",
      "seed",
      "synthetic_only",
      "tenants",
      "platform",
      "load"
    ],
    "properties": {
      "schema_version": {
        "const": "perf_actor_fixture_v1"
      },
      "fixture_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "fixture_revision": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "purpose": {
        "type": "string",
        "minLength": 1,
        "maxLength": 600
      },
      "k_scenarios": {
        "type": "array",
        "minItems": 1,
        "maxItems": 12,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/KScenario"
        }
      },
      "seed": {
        "description": "Seeds every pseudo-random choice of the population and of the load; the same seed gives the same population.",
        "type": "integer",
        "minimum": 0,
        "maximum": 4294967295
      },
      "synthetic_only": {
        "const": true
      },
      "tenants": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "count",
          "plan_key",
          "actors_per_tenant",
          "library_objects_per_tenant",
          "projects_per_tenant"
        ],
        "properties": {
          "count": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50
          },
          "plan_key": {
            "description": "The synthetic plan the tenants hold; it must enable the surfaces the run measures.",
            "$ref": "common.schema.json#/$defs/ProfileId"
          },
          "actors_per_tenant": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "owner",
              "editor",
              "viewer"
            ],
            "properties": {
              "owner": {
                "type": "integer",
                "minimum": 1,
                "maximum": 5
              },
              "editor": {
                "type": "integer",
                "minimum": 0,
                "maximum": 20
              },
              "viewer": {
                "type": "integer",
                "minimum": 0,
                "maximum": 50
              }
            }
          },
          "library_objects_per_tenant": {
            "description": "Storage objects already in the personal library before the run.",
            "type": "integer",
            "minimum": 0,
            "maximum": 5000
          },
          "projects_per_tenant": {
            "type": "array",
            "maxItems": 8,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "mix",
                "copies"
              ],
              "properties": {
                "mix": {
                  "$ref": "common.schema.json#/$defs/VersionedRef"
                },
                "copies": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 20
                }
              }
            }
          }
        }
      },
      "platform": {
        "description": "Volumes that exist once for the whole platform, not per tenant.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "catalog_items",
          "community_publications",
          "registered_usernames"
        ],
        "properties": {
          "catalog_items": {
            "type": "integer",
            "minimum": 0,
            "maximum": 200000
          },
          "community_publications": {
            "type": "integer",
            "minimum": 0,
            "maximum": 200000
          },
          "registered_usernames": {
            "type": "integer",
            "minimum": 0,
            "maximum": 10000000
          }
        }
      },
      "load": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "concurrent_actors",
          "ramp_seconds",
          "duration_seconds",
          "think_time_ms"
        ],
        "properties": {
          "concurrent_actors": {
            "type": "integer",
            "minimum": 1,
            "maximum": 200
          },
          "ramp_seconds": {
            "type": "integer",
            "minimum": 0,
            "maximum": 3600
          },
          "duration_seconds": {
            "type": "integer",
            "minimum": 60,
            "maximum": 14400
          },
          "think_time_ms": {
            "type": "integer",
            "minimum": 0,
            "maximum": 60000
          }
        }
      },
      "burst": {
        "description": "An optional one-off event shape laid over the steady load.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "events",
          "window_seconds"
        ],
        "properties": {
          "kind": {
            "enum": [
              "report_surge",
              "revoke_wave",
              "username_race"
            ]
          },
          "events": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100000
          },
          "window_seconds": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3600
          }
        }
      }
    }
  },
  "perf-device-profile.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/perf-measurement/v1/perf-device-profile.schema.json",
    "title": "perf_device_profile_v1",
    "description": "A target client device class of the editor/catalog/community measurements (FAZ-07 P07-13; BAGIMLILIK \u00a73: P05-11 needs the target device definition early). The values are frozen per profile revision: a change is a new revision with a reason, never an edit after a result was seen. The browser engine is pinned by class; the exact browser build is recorded on every run, not guessed here.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "profile_id",
      "profile_revision",
      "device_class",
      "purpose",
      "k_scenarios",
      "viewport",
      "input",
      "cpu",
      "memory",
      "gpu",
      "network",
      "browser",
      "applies_to"
    ],
    "properties": {
      "schema_version": {
        "const": "perf_device_profile_v1"
      },
      "profile_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "profile_revision": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "device_class": {
        "enum": [
          "desktop",
          "laptop",
          "narrow_viewport"
        ]
      },
      "purpose": {
        "type": "string",
        "minLength": 1,
        "maxLength": 600
      },
      "k_scenarios": {
        "type": "array",
        "minItems": 1,
        "maxItems": 12,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/KScenario"
        }
      },
      "viewport": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "width",
          "height",
          "device_pixel_ratio"
        ],
        "properties": {
          "width": {
            "type": "integer",
            "minimum": 320,
            "maximum": 3840
          },
          "height": {
            "type": "integer",
            "minimum": 320,
            "maximum": 2160
          },
          "device_pixel_ratio": {
            "type": "number",
            "minimum": 1,
            "maximum": 4
          }
        }
      },
      "edge_viewports": {
        "description": "Extra viewports the functional checks run at (K240: 767/768 and 1279/1280 breakpoints). They add no timing samples.",
        "type": "array",
        "maxItems": 8,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "width",
            "height"
          ],
          "properties": {
            "width": {
              "type": "integer",
              "minimum": 320,
              "maximum": 3840
            },
            "height": {
              "type": "integer",
              "minimum": 320,
              "maximum": 2160
            }
          }
        }
      },
      "input": {
        "enum": [
          "pointer",
          "touch"
        ]
      },
      "cpu": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "logical_cores_min",
          "throttle_rate"
        ],
        "properties": {
          "logical_cores_min": {
            "type": "integer",
            "minimum": 1,
            "maximum": 128
          },
          "throttle_rate": {
            "description": "DevTools CPU throttling rate (1 = none, 4 = 4x slowdown). A throttled run still needs the minimum cores of the class.",
            "type": "number",
            "minimum": 1,
            "maximum": 20
          }
        }
      },
      "memory": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "device_memory_gb_min"
        ],
        "properties": {
          "device_memory_gb_min": {
            "type": "integer",
            "minimum": 2,
            "maximum": 256
          }
        }
      },
      "gpu": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "hardware_acceleration"
        ],
        "properties": {
          "hardware_acceleration": {
            "type": "boolean"
          }
        }
      },
      "network": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "name",
          "download_kbps",
          "upload_kbps",
          "rtt_ms"
        ],
        "properties": {
          "name": {
            "$ref": "common.schema.json#/$defs/ProfileId"
          },
          "download_kbps": {
            "type": "integer",
            "minimum": 100,
            "maximum": 10000000
          },
          "upload_kbps": {
            "type": "integer",
            "minimum": 100,
            "maximum": 10000000
          },
          "rtt_ms": {
            "type": "integer",
            "minimum": 0,
            "maximum": 2000
          }
        }
      },
      "browser": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "engine",
          "channel",
          "version_recorded_per_run"
        ],
        "properties": {
          "engine": {
            "const": "chromium"
          },
          "channel": {
            "const": "stable"
          },
          "version_recorded_per_run": {
            "description": "The exact build is part of every measurement record; a result never claims a build the record does not name.",
            "const": true
          }
        }
      },
      "applies_to": {
        "type": "array",
        "minItems": 1,
        "maxItems": 7,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/Surface"
        }
      }
    }
  },
  "perf-measurement-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/perf-measurement/v1/perf-measurement-plan.schema.json",
    "title": "perf_measurement_plan_v1",
    "description": "What a measurement campaign runs (FAZ-07 P07-13): the interaction scripts and the runs, each pinning a device profile, a tenant/actor fixture, a project mix, an interaction script, a temperature and the metrics it records. The plan pins the exact frozen thresholds revision it measures against. It defines the runs; it never contains a result.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "plan_id",
      "plan_revision",
      "thresholds",
      "interaction_scripts",
      "runs"
    ],
    "properties": {
      "schema_version": {
        "const": "perf_measurement_plan_v1"
      },
      "plan_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "plan_revision": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "thresholds": {
        "$ref": "common.schema.json#/$defs/VersionedRef"
      },
      "interaction_scripts": {
        "type": "array",
        "minItems": 1,
        "maxItems": 24,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "script_id",
            "title",
            "surface",
            "steps"
          ],
          "properties": {
            "script_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "surface": {
              "$ref": "common.schema.json#/$defs/Surface"
            },
            "loop_seconds": {
              "description": "When present the steps repeat until this many seconds passed (a soak); otherwise they run once per repetition.",
              "type": "integer",
              "minimum": 60,
              "maximum": 14400
            },
            "steps": {
              "type": "array",
              "minItems": 1,
              "maxItems": 16,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "action"
                ],
                "properties": {
                  "action": {
                    "enum": [
                      "open_project",
                      "close_project",
                      "reopen_project",
                      "scroll_strip",
                      "seek_random",
                      "scrub_drag",
                      "trim_drag",
                      "play",
                      "idle",
                      "open_media_grid",
                      "range_probe",
                      "revoke_access",
                      "mint_after_revoke",
                      "search_catalog",
                      "acquire_item",
                      "check_username",
                      "claim_username_race",
                      "submit_report",
                      "reconnect_admin_stream",
                      "revoke_publication",
                      "export_project",
                      "api_command_commit",
                      "api_accept_status"
                    ]
                  },
                  "count": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10000
                  },
                  "duration_ms": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 3600000
                  },
                  "span_seconds": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 600
                  }
                }
              }
            }
          }
        }
      },
      "runs": {
        "type": "array",
        "minItems": 1,
        "maxItems": 48,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "run_id",
            "device_profiles",
            "actor_fixture",
            "interaction_script",
            "temperature",
            "repetitions",
            "metrics"
          ],
          "properties": {
            "run_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "device_profiles": {
              "description": "The run repeats on each listed device profile.",
              "type": "array",
              "minItems": 1,
              "maxItems": 3,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/VersionedRef"
              }
            },
            "actor_fixture": {
              "$ref": "common.schema.json#/$defs/VersionedRef"
            },
            "project_mix": {
              "$ref": "common.schema.json#/$defs/VersionedRef"
            },
            "interaction_script": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "temperature": {
              "$ref": "common.schema.json#/$defs/Temperature"
            },
            "repetitions": {
              "description": "Samples per metric and device; the protocol minimum is 30 (KARAR-FRAME-EXTRACT-VE-SANDBOX: a single fast sample is no evidence).",
              "type": "integer",
              "minimum": 30,
              "maximum": 1000
            },
            "metrics": {
              "type": "array",
              "minItems": 1,
              "maxItems": 40,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/MetricId"
              }
            }
          }
        }
      }
    }
  },
  "perf-measurement-record.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/perf-measurement/v1/perf-measurement-record.schema.json",
    "title": "perf_measurement_record_v1",
    "description": "How one measurement campaign is recorded (FAZ-07 P07-13; K150: a gate that was not measured is never done). A record pins the plan, the frozen thresholds revision and its hash, the commit and the browser build, keeps every raw sample (nothing is removed as an outlier), the result of each metric derived from those samples, the cost owner of the resources the run used and the campaign verdict. A record of kind evaluator_fixture only tests the evaluator and carries synthetic numbers: it is never a measurement and can never be read as one.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "record_id",
      "record_kind",
      "recorded_at",
      "plan",
      "thresholds",
      "thresholds_sha256",
      "environment",
      "runs",
      "results",
      "cost_owner",
      "coverage",
      "verdict"
    ],
    "properties": {
      "schema_version": {
        "const": "perf_measurement_record_v1"
      },
      "record_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "record_kind": {
        "enum": [
          "measurement",
          "evaluator_fixture"
        ]
      },
      "recorded_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "plan": {
        "$ref": "common.schema.json#/$defs/VersionedRef"
      },
      "thresholds": {
        "$ref": "common.schema.json#/$defs/VersionedRef"
      },
      "thresholds_sha256": {
        "description": "Canonical sha256 of the frozen thresholds revision the results were evaluated against (perf-rules.json freeze.registry).",
        "$ref": "common.schema.json#/$defs/Sha256"
      },
      "environment": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "commit_sha"
        ],
        "properties": {
          "kind": {
            "enum": [
              "dev_cluster",
              "local",
              "ci",
              "fixture"
            ]
          },
          "commit_sha": {
            "type": "string",
            "pattern": "^[a-f0-9]{40}$"
          },
          "browser": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "version"
            ],
            "properties": {
              "name": {
                "const": "chromium"
              },
              "version": {
                "type": "string",
                "pattern": "^[0-9]+(\\.[0-9]+){1,3}$"
              }
            }
          },
          "note": {
            "type": "string",
            "maxLength": 500
          }
        }
      },
      "runs": {
        "type": "array",
        "minItems": 1,
        "maxItems": 96,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "run_id",
            "device_profile",
            "actor_fixture",
            "temperature"
          ],
          "properties": {
            "run_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "device_profile": {
              "$ref": "common.schema.json#/$defs/VersionedRef"
            },
            "actor_fixture": {
              "$ref": "common.schema.json#/$defs/VersionedRef"
            },
            "project_mix": {
              "$ref": "common.schema.json#/$defs/VersionedRef"
            },
            "temperature": {
              "$ref": "common.schema.json#/$defs/Temperature"
            }
          }
        }
      },
      "results": {
        "type": "array",
        "minItems": 1,
        "maxItems": 400,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "metric_id",
            "device_profile",
            "temperature",
            "samples",
            "result"
          ],
          "properties": {
            "metric_id": {
              "$ref": "common.schema.json#/$defs/MetricId"
            },
            "device_profile": {
              "description": "The device profile the samples were taken on, or any for a server-side metric.",
              "type": "string",
              "pattern": "^(any|[a-z][a-z0-9-]{2,63})$"
            },
            "temperature": {
              "$ref": "common.schema.json#/$defs/Temperature"
            },
            "sample_interval_seconds": {
              "description": "Seconds between the readings of a growth series.",
              "type": "integer",
              "minimum": 1,
              "maximum": 3600
            },
            "samples": {
              "description": "Every raw sample in the order it was taken. A failed sample is recorded as a sample and as a failure of the run, never dropped.",
              "type": "array",
              "maxItems": 10000,
              "items": {
                "type": "number"
              }
            },
            "result": {
              "enum": [
                "pass",
                "fail",
                "insufficient_samples",
                "not_measured",
                "reported"
              ]
            },
            "statistic_value": {
              "type": "number"
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "result": {
                    "enum": [
                      "pass",
                      "fail",
                      "reported"
                    ]
                  }
                },
                "required": [
                  "result"
                ]
              },
              "then": {
                "required": [
                  "statistic_value"
                ]
              },
              "else": {
                "not": {
                  "required": [
                    "statistic_value"
                  ]
                }
              }
            }
          ]
        }
      },
      "cost_owner": {
        "description": "Who pays for what the run consumed. An unattributed amount is a measurement gap, not a free resource.",
        "type": "array",
        "maxItems": 64,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "resource",
            "owner",
            "amount",
            "unit"
          ],
          "properties": {
            "resource": {
              "enum": [
                "egress_bytes",
                "io_bytes",
                "compute_ms",
                "db_queries"
              ]
            },
            "owner": {
              "enum": [
                "platform_catalog",
                "consumer_tenant",
                "system_derivative",
                "community_publisher",
                "unattributed"
              ]
            },
            "amount": {
              "type": "number",
              "minimum": 0
            },
            "unit": {
              "enum": [
                "bytes",
                "ms",
                "queries"
              ]
            }
          }
        }
      },
      "coverage": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "gate_metrics_total",
          "gate_metrics_recorded",
          "missing_gate_metrics"
        ],
        "properties": {
          "gate_metrics_total": {
            "type": "integer",
            "minimum": 0
          },
          "gate_metrics_recorded": {
            "type": "integer",
            "minimum": 0
          },
          "missing_gate_metrics": {
            "type": "array",
            "maxItems": 80,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/MetricId"
            }
          }
        }
      },
      "verdict": {
        "enum": [
          "pass",
          "fail",
          "incomplete"
        ]
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "record_kind": {
              "const": "measurement"
            }
          },
          "required": [
            "record_kind"
          ]
        },
        "then": {
          "properties": {
            "environment": {
              "properties": {
                "kind": {
                  "enum": [
                    "dev_cluster",
                    "local",
                    "ci"
                  ]
                }
              },
              "required": [
                "browser"
              ]
            }
          }
        },
        "else": {
          "properties": {
            "environment": {
              "properties": {
                "kind": {
                  "const": "fixture"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "verdict": {
              "const": "pass"
            }
          },
          "required": [
            "verdict"
          ]
        },
        "then": {
          "properties": {
            "coverage": {
              "properties": {
                "missing_gate_metrics": {
                  "maxItems": 0
                }
              }
            }
          }
        }
      }
    ]
  },
  "perf-project-mix.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/perf-measurement/v1/perf-project-mix.schema.json",
    "title": "perf_project_mix_v1",
    "description": "A project fixture of the editor measurements (FAZ-05 P05-11, FAZ-07 P07-13): a mixed scene/layer project of an exact duration with large images, GIFs, 1080p/4K video and audio. The mix is a specification, not binary files: a deterministic expansion (perf-rules.json mix_expansion) turns it into scenes, layers and assets, and the declared expected totals must equal that expansion. It never claims a measurement.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "mix_id",
      "mix_revision",
      "purpose",
      "k_scenarios",
      "seed",
      "canvas",
      "duration_seconds",
      "asset_classes",
      "scene_groups",
      "project_layers",
      "expected"
    ],
    "properties": {
      "schema_version": {
        "const": "perf_project_mix_v1"
      },
      "mix_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "mix_revision": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "purpose": {
        "type": "string",
        "minLength": 1,
        "maxLength": 600
      },
      "k_scenarios": {
        "type": "array",
        "minItems": 1,
        "maxItems": 12,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/KScenario"
        }
      },
      "seed": {
        "description": "Seeds the synthetic media bytes and any tie-break of a generator; the expansion itself is fully determined by the specification.",
        "type": "integer",
        "minimum": 0,
        "maximum": 4294967295
      },
      "canvas": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "width",
          "height",
          "fps"
        ],
        "properties": {
          "width": {
            "type": "integer",
            "minimum": 16,
            "maximum": 7680
          },
          "height": {
            "type": "integer",
            "minimum": 16,
            "maximum": 4320
          },
          "fps": {
            "type": "integer",
            "minimum": 1,
            "maximum": 120
          }
        }
      },
      "duration_seconds": {
        "description": "Exact project duration; the scene groups add up to it.",
        "type": "integer",
        "minimum": 1,
        "maximum": 3600
      },
      "asset_classes": {
        "type": "array",
        "minItems": 1,
        "maxItems": 24,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "class_id",
            "kind",
            "mime_type",
            "count",
            "size_bytes"
          ],
          "properties": {
            "class_id": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{1,31}$"
            },
            "kind": {
              "$ref": "common.schema.json#/$defs/AssetKind"
            },
            "mime_type": {
              "type": "string",
              "pattern": "^(image|video|audio)/[a-z0-9.+-]{1,40}$"
            },
            "count": {
              "description": "Distinct assets of the class. Every asset is referenced at least once (round-robin), so the count never exceeds the references.",
              "type": "integer",
              "minimum": 1,
              "maximum": 500
            },
            "size_bytes": {
              "description": "Original byte size of each asset of the class.",
              "type": "integer",
              "minimum": 1,
              "maximum": 1099511627776
            },
            "width": {
              "type": "integer",
              "minimum": 1,
              "maximum": 16384
            },
            "height": {
              "type": "integer",
              "minimum": 1,
              "maximum": 16384
            },
            "frame_count": {
              "description": "Frames of one asset: 1 for a still image, the animation frames of a GIF, the decodable frames of a video.",
              "type": "integer",
              "minimum": 1,
              "maximum": 1000000
            },
            "duration_seconds": {
              "description": "Playing time of a video or audio asset.",
              "type": "integer",
              "minimum": 1,
              "maximum": 36000
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "kind": {
                    "const": "audio"
                  }
                },
                "required": [
                  "kind"
                ]
              },
              "then": {
                "required": [
                  "duration_seconds"
                ],
                "not": {
                  "anyOf": [
                    {
                      "required": [
                        "width"
                      ]
                    },
                    {
                      "required": [
                        "height"
                      ]
                    },
                    {
                      "required": [
                        "frame_count"
                      ]
                    }
                  ]
                }
              },
              "else": {
                "required": [
                  "width",
                  "height",
                  "frame_count"
                ]
              }
            }
          ]
        }
      },
      "scene_groups": {
        "type": "array",
        "minItems": 1,
        "maxItems": 24,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "group_id",
            "scene_count",
            "scene_seconds",
            "layers"
          ],
          "properties": {
            "group_id": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{1,31}$"
            },
            "scene_count": {
              "type": "integer",
              "minimum": 1,
              "maximum": 200
            },
            "scene_seconds": {
              "description": "Whole seconds of every scene of the group (a scene is at least one frame).",
              "type": "integer",
              "minimum": 1,
              "maximum": 3600
            },
            "layers": {
              "type": "array",
              "minItems": 1,
              "maxItems": 12,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "count",
                  "animations_per_layer"
                ],
                "properties": {
                  "kind": {
                    "$ref": "common.schema.json#/$defs/LayerKind"
                  },
                  "count": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 60
                  },
                  "asset_class": {
                    "type": "string",
                    "pattern": "^[a-z][a-z0-9_]{1,31}$"
                  },
                  "animations_per_layer": {
                    "description": "AnimationSpec per layer (KARAR-SPARK-SAHNE-SERIDI limit: at most 6).",
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 6
                  }
                },
                "allOf": [
                  {
                    "if": {
                      "properties": {
                        "kind": {
                          "const": "clip"
                        }
                      },
                      "required": [
                        "kind"
                      ]
                    },
                    "then": {
                      "required": [
                        "asset_class"
                      ]
                    },
                    "else": {
                      "not": {
                        "required": [
                          "asset_class"
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      },
      "project_layers": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "overlays",
          "caption_tracks",
          "audio_placements"
        ],
        "properties": {
          "overlays": {
            "type": "integer",
            "minimum": 0,
            "maximum": 20
          },
          "caption_tracks": {
            "type": "integer",
            "minimum": 0,
            "maximum": 4
          },
          "audio_placements": {
            "type": "array",
            "maxItems": 8,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "role",
                "count",
                "asset_class"
              ],
              "properties": {
                "role": {
                  "enum": [
                    "narration",
                    "music",
                    "sfx"
                  ]
                },
                "count": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 200
                },
                "asset_class": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]{1,31}$"
                }
              }
            }
          }
        }
      },
      "expected": {
        "description": "The totals the deterministic expansion must produce. A generator or a test that expands the specification and disagrees is wrong, not the totals.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "scene_count",
          "layer_count",
          "max_layers_in_scene",
          "total_frames",
          "distinct_asset_count",
          "original_bytes",
          "decoded_pixels_worst_case",
          "assets_over_preview_budget"
        ],
        "properties": {
          "scene_count": {
            "type": "integer",
            "minimum": 1
          },
          "layer_count": {
            "description": "Scene layers only; project overlays, caption tracks and audio placements are counted in project_layers.",
            "type": "integer",
            "minimum": 1
          },
          "max_layers_in_scene": {
            "type": "integer",
            "minimum": 1
          },
          "total_frames": {
            "type": "integer",
            "minimum": 1
          },
          "distinct_asset_count": {
            "type": "integer",
            "minimum": 1
          },
          "original_bytes": {
            "type": "integer",
            "minimum": 1
          },
          "decoded_pixels_worst_case": {
            "description": "Sum over the distinct assets of width x height x frame_count: what a full decode of every original would hold in pixels. Audio decodes no pixels.",
            "type": "integer",
            "minimum": 0
          },
          "assets_over_preview_budget": {
            "description": "Distinct visual assets (image, GIF, video) whose original is larger than the 2 MiB preview original budget (P02-14): a grid or card must show a derivative, never their original. Audio is not counted.",
            "type": "integer",
            "minimum": 0
          }
        }
      }
    }
  },
  "perf-thresholds.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/perf-measurement/v1/perf-thresholds.schema.json",
    "title": "perf_thresholds_v1",
    "description": "The metric catalogue and the frozen thresholds of the editor/catalog/community measurements (FAZ-07 P07-13: 'Threshold'lari once dondur'). Every number is fixed before any measurement and is a candidate target, never a result. A revision is immutable: a change is a new revision that names the one it supersedes and why, and needs new full evidence; a threshold is never relaxed after a result was seen (KARAR-FRAME-EXTRACT-VE-SANDBOX). A metric that is report-only carries no bound and never gates.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "thresholds_id",
      "thresholds_revision",
      "status",
      "frozen_at",
      "statement",
      "metrics"
    ],
    "properties": {
      "schema_version": {
        "const": "perf_thresholds_v1"
      },
      "thresholds_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "thresholds_revision": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "status": {
        "const": "frozen"
      },
      "frozen_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "supersedes": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "revision",
          "reason"
        ],
        "properties": {
          "revision": {
            "$ref": "common.schema.json#/$defs/Revision"
          },
          "reason": {
            "type": "string",
            "minLength": 20,
            "maxLength": 1000
          }
        }
      },
      "statement": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "metrics": {
        "type": "array",
        "minItems": 1,
        "maxItems": 80,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "metric_id",
            "surface",
            "title",
            "k_scenarios",
            "unit",
            "statistic",
            "gate",
            "source",
            "basis",
            "basis_note",
            "bounds"
          ],
          "properties": {
            "metric_id": {
              "$ref": "common.schema.json#/$defs/MetricId"
            },
            "surface": {
              "$ref": "common.schema.json#/$defs/Surface"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "k_scenarios": {
              "type": "array",
              "minItems": 1,
              "maxItems": 8,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/KScenario"
              }
            },
            "unit": {
              "$ref": "common.schema.json#/$defs/Unit"
            },
            "statistic": {
              "$ref": "common.schema.json#/$defs/Statistic"
            },
            "gate": {
              "description": "true: the bounds decide pass/fail. false: the metric is only reported (a cost, a size or a queue depth whose limit is another task's decision) and has no bound.",
              "type": "boolean"
            },
            "source": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind"
              ],
              "properties": {
                "kind": {
                  "$ref": "common.schema.json#/$defs/SourceKind"
                },
                "name": {
                  "description": "prometheus: the exported series name; harness: the probe the run harness uses.",
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 120
                },
                "route": {
                  "description": "prometheus only: the Express route template the route label selects.",
                  "type": "string",
                  "pattern": "^/[A-Za-z0-9/:_-]{1,200}$"
                },
                "gap": {
                  "description": "not_instrumented only: what has to be measured before this metric can be recorded.",
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 400
                }
              },
              "allOf": [
                {
                  "if": {
                    "properties": {
                      "kind": {
                        "const": "not_instrumented"
                      }
                    },
                    "required": [
                      "kind"
                    ]
                  },
                  "then": {
                    "required": [
                      "gap"
                    ],
                    "not": {
                      "anyOf": [
                        {
                          "required": [
                            "name"
                          ]
                        },
                        {
                          "required": [
                            "route"
                          ]
                        }
                      ]
                    }
                  },
                  "else": {
                    "required": [
                      "name"
                    ],
                    "not": {
                      "required": [
                        "gap"
                      ]
                    }
                  }
                },
                {
                  "if": {
                    "properties": {
                      "kind": {
                        "const": "harness"
                      }
                    },
                    "required": [
                      "kind"
                    ]
                  },
                  "then": {
                    "not": {
                      "required": [
                        "route"
                      ]
                    }
                  }
                }
              ]
            },
            "basis": {
              "$ref": "common.schema.json#/$defs/Basis"
            },
            "basis_note": {
              "type": "string",
              "minLength": 1,
              "maxLength": 400
            },
            "bounds": {
              "type": "array",
              "maxItems": 12,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "device_profile",
                  "temperature",
                  "operator",
                  "value"
                ],
                "properties": {
                  "device_profile": {
                    "description": "A device profile id, or any for a server-side metric that no device changes.",
                    "type": "string",
                    "pattern": "^(any|[a-z][a-z0-9-]{2,63})$"
                  },
                  "temperature": {
                    "$ref": "common.schema.json#/$defs/TemperatureOrAny"
                  },
                  "operator": {
                    "$ref": "common.schema.json#/$defs/Operator"
                  },
                  "value": {
                    "type": "number",
                    "minimum": 0
                  }
                }
              }
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "gate": {
                    "const": true
                  }
                },
                "required": [
                  "gate"
                ]
              },
              "then": {
                "properties": {
                  "bounds": {
                    "minItems": 1
                  }
                }
              },
              "else": {
                "properties": {
                  "bounds": {
                    "maxItems": 0
                  }
                }
              }
            }
          ]
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "thresholds_revision": {
              "minimum": 2
            }
          },
          "required": [
            "thresholds_revision"
          ]
        },
        "then": {
          "required": [
            "supersedes"
          ]
        },
        "else": {
          "not": {
            "required": [
              "supersedes"
            ]
          }
        }
      }
    ]
  }
} as const;

// Foreign schema files reached through cross-package $refs, embedded verbatim
// from their owner package and registered next to SCHEMAS.
export const DEPENDENCY_SCHEMAS = {
  "assistant-runtime/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json",
    "title": "assistant_runtime_common_v1",
    "description": "Shared scalar and enum definitions for the assistant-runtime v1 package. Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "EnvelopeId": {
        "description": "Billing spend envelope id; format owned by P00-10 (spend-envelope v1), mirrored here until cross-package $ref is allowed after Wave 0.",
        "type": "string",
        "pattern": "^env_[A-Za-z0-9_-]{3,64}$"
      },
      "AllocationId": {
        "description": "Billing allocation id; format owned by P00-10 (spend-envelope v1), mirrored here until cross-package $ref is allowed after Wave 0.",
        "type": "string",
        "pattern": "^alc_[A-Za-z0-9_-]{3,64}$"
      },
      "CompositionProjectId": {
        "description": "Composition project id of the Spark project entry (PR #294): private, tenant + owner scoped, cprj_<uuid>. P00-07 scope-grants and P00-10 use the same format.",
        "type": "string",
        "pattern": "^cprj_[0-9a-f-]{36}$"
      },
      "ModelId": {
        "description": "Public model catalog id (same shape as the current AssistantModelIdSchema).",
        "type": "string",
        "pattern": "^[A-Za-z0-9._:-]{1,128}$"
      },
      "CapabilityKey": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
        "maxLength": 128
      },
      "Sha256": {
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "Version": {
        "description": "Monotonic owner version counter used for CAS.",
        "type": "integer",
        "minimum": 0
      },
      "Revision": {
        "description": "Immutable revision number; the first revision is 1.",
        "type": "integer",
        "minimum": 1
      },
      "Generation": {
        "description": "P00-07 scope/grant generation of a source resource (scope-grants v1 Generation): every change of who may read the source increments it.",
        "type": "integer",
        "minimum": 1
      },
      "Visibility": {
        "description": "P00-07 resource visibility (scope-grants v1 Visibility): private = owner only, shared = owner + explicit grants.",
        "enum": [
          "private",
          "shared"
        ]
      },
      "EventSequence": {
        "description": "Durable conversation/run event ordinal (P01-15 cursor), never a wall-clock cutoff.",
        "type": "integer",
        "minimum": 0
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Surface": {
        "description": "Client surface that produced the message. Surface context never grants authority. `motion_authoring` (E1-H, additive v1) is the Motion screen's chat of one private Motion draft.",
        "enum": [
          "dashboard_chat",
          "spark_chat",
          "workflow_authoring",
          "motion_authoring"
        ]
      },
      "Mode": {
        "description": "Canonical execution mode name (KARAR-PLAN-QA-KAPANIS \u00a74, Q24/Q74). Legacy approval_mode=autonomous normalizes to auto. The mode/grant model itself is owned by P00-13 assistant schemas and P00-11.",
        "enum": [
          "ask",
          "auto",
          "auto_full"
        ]
      },
      "Channel": {
        "description": "Invocation channel; maps 1:1 to the P00-10 funding_channel value (TK-15).",
        "enum": [
          "app",
          "api",
          "mcp"
        ]
      },
      "JobStatus": {
        "description": "Normative owner-projection job_status (KARAR-PLAN-QA-KAPANIS \u00a73 + TK-03). waiting_input is the only input-wait status name (Q78); forbidden spellings are listed in field-dictionary.json.",
        "enum": [
          "draft",
          "preparing",
          "waiting_input",
          "plan_ready",
          "awaiting_g1",
          "funding_required",
          "admitted",
          "queued",
          "producing",
          "partial",
          "preview_ready",
          "awaiting_g2",
          "rendering",
          "completed",
          "failed",
          "canceled",
          "rejected",
          "expired"
        ]
      },
      "AttentionFlag": {
        "description": "Typed attention flags, separate from job_status (TK-03). funding_required is a job_status, not a flag.",
        "enum": [
          "sync_required",
          "fallback_used",
          "needs_connection",
          "unsupported_script",
          "admin_review"
        ]
      },
      "ApiFamily": {
        "description": "Provider protocol family of a native serializer (KARAR-COKLU-MODEL \u00a76).",
        "enum": [
          "openai_responses",
          "openai_chat_completions_compatible",
          "gemini_interactions",
          "gemini_generate_content",
          "anthropic_messages"
        ]
      },
      "OwnerBc": {
        "enum": [
          "assistant",
          "avatar",
          "billing",
          "brand",
          "composition",
          "connector",
          "memory",
          "provider",
          "review",
          "storage",
          "voice",
          "workflow"
        ]
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["perf-actor-fixture", "perf-device-profile", "perf-measurement-plan", "perf-measurement-record", "perf-project-mix", "perf-thresholds"] as const;
export type DocumentType = "perf-actor-fixture" | "perf-device-profile" | "perf-measurement-plan" | "perf-measurement-record" | "perf-project-mix" | "perf-thresholds";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "perf-actor-fixture": [
    "perf_actor_fixture_v1"
  ],
  "perf-device-profile": [
    "perf_device_profile_v1"
  ],
  "perf-measurement-plan": [
    "perf_measurement_plan_v1"
  ],
  "perf-measurement-record": [
    "perf_measurement_record_v1"
  ],
  "perf-project-mix": [
    "perf_project_mix_v1"
  ],
  "perf-thresholds": [
    "perf_thresholds_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type PerfActorFixture = {
    readonly "schema_version": "perf_actor_fixture_v1";
    readonly "fixture_id": string;
    readonly "fixture_revision": number;
    readonly "purpose": string;
    readonly "k_scenarios": readonly (string)[];
    readonly "seed": number;
    readonly "synthetic_only": true;
    readonly "tenants": {
    readonly "count": number;
    readonly "plan_key": string;
    readonly "actors_per_tenant": {
    readonly "owner": number;
    readonly "editor": number;
    readonly "viewer": number;
  };
    readonly "library_objects_per_tenant": number;
    readonly "projects_per_tenant": readonly ({
    readonly "mix": unknown;
    readonly "copies": number;
  })[];
  };
    readonly "platform": {
    readonly "catalog_items": number;
    readonly "community_publications": number;
    readonly "registered_usernames": number;
  };
    readonly "load": {
    readonly "concurrent_actors": number;
    readonly "ramp_seconds": number;
    readonly "duration_seconds": number;
    readonly "think_time_ms": number;
  };
    readonly "burst"?: {
    readonly "kind": "report_surge" | "revoke_wave" | "username_race";
    readonly "events": number;
    readonly "window_seconds": number;
  };
  };
export type PerfDeviceProfile = {
    readonly "schema_version": "perf_device_profile_v1";
    readonly "profile_id": string;
    readonly "profile_revision": number;
    readonly "device_class": "desktop" | "laptop" | "narrow_viewport";
    readonly "purpose": string;
    readonly "k_scenarios": readonly (string)[];
    readonly "viewport": {
    readonly "width": number;
    readonly "height": number;
    readonly "device_pixel_ratio": number;
  };
    readonly "edge_viewports"?: readonly ({
    readonly "width": number;
    readonly "height": number;
  })[];
    readonly "input": "pointer" | "touch";
    readonly "cpu": {
    readonly "logical_cores_min": number;
    readonly "throttle_rate": number;
  };
    readonly "memory": {
    readonly "device_memory_gb_min": number;
  };
    readonly "gpu": {
    readonly "hardware_acceleration": boolean;
  };
    readonly "network": {
    readonly "name": string;
    readonly "download_kbps": number;
    readonly "upload_kbps": number;
    readonly "rtt_ms": number;
  };
    readonly "browser": {
    readonly "engine": "chromium";
    readonly "channel": "stable";
    readonly "version_recorded_per_run": true;
  };
    readonly "applies_to": readonly ("editor" | "delivery" | "catalog" | "username" | "community" | "api" | "worker")[];
  };
export type PerfMeasurementPlan = {
    readonly "schema_version": "perf_measurement_plan_v1";
    readonly "plan_id": string;
    readonly "plan_revision": number;
    readonly "thresholds": unknown;
    readonly "interaction_scripts": readonly ({
    readonly "script_id": string;
    readonly "title": string;
    readonly "surface": "editor" | "delivery" | "catalog" | "username" | "community" | "api" | "worker";
    readonly "loop_seconds"?: number;
    readonly "steps": readonly ({
    readonly "action": "open_project" | "close_project" | "reopen_project" | "scroll_strip" | "seek_random" | "scrub_drag" | "trim_drag" | "play" | "idle" | "open_media_grid" | "range_probe" | "revoke_access" | "mint_after_revoke" | "search_catalog" | "acquire_item" | "check_username" | "claim_username_race" | "submit_report" | "reconnect_admin_stream" | "revoke_publication" | "export_project" | "api_command_commit" | "api_accept_status";
    readonly "count"?: number;
    readonly "duration_ms"?: number;
    readonly "span_seconds"?: number;
  })[];
  })[];
    readonly "runs": readonly ({
    readonly "run_id": string;
    readonly "device_profiles": readonly (unknown)[];
    readonly "actor_fixture": unknown;
    readonly "project_mix"?: unknown;
    readonly "interaction_script": string;
    readonly "temperature": "cold" | "warm" | "soak";
    readonly "repetitions": number;
    readonly "metrics": readonly (string)[];
  })[];
  };
export type PerfMeasurementRecord = {
    readonly "schema_version": "perf_measurement_record_v1";
    readonly "record_id": string;
    readonly "record_kind": "measurement" | "evaluator_fixture";
    readonly "recorded_at": unknown;
    readonly "plan": unknown;
    readonly "thresholds": unknown;
    readonly "thresholds_sha256": unknown;
    readonly "environment": {
    readonly "kind": "dev_cluster" | "local" | "ci" | "fixture";
    readonly "commit_sha": string;
    readonly "browser"?: {
    readonly "name": "chromium";
    readonly "version": string;
  };
    readonly "note"?: string;
  };
    readonly "runs": readonly ({
    readonly "run_id": string;
    readonly "device_profile": unknown;
    readonly "actor_fixture": unknown;
    readonly "project_mix"?: unknown;
    readonly "temperature": "cold" | "warm" | "soak";
  })[];
    readonly "results": readonly ({
    readonly "metric_id": string;
    readonly "device_profile": string;
    readonly "temperature": "cold" | "warm" | "soak";
    readonly "sample_interval_seconds"?: number;
    readonly "samples": readonly (number)[];
    readonly "result": "pass" | "fail" | "insufficient_samples" | "not_measured" | "reported";
    readonly "statistic_value"?: number;
  })[];
    readonly "cost_owner": readonly ({
    readonly "resource": "egress_bytes" | "io_bytes" | "compute_ms" | "db_queries";
    readonly "owner": "platform_catalog" | "consumer_tenant" | "system_derivative" | "community_publisher" | "unattributed";
    readonly "amount": number;
    readonly "unit": "bytes" | "ms" | "queries";
  })[];
    readonly "coverage": {
    readonly "gate_metrics_total": number;
    readonly "gate_metrics_recorded": number;
    readonly "missing_gate_metrics": readonly (string)[];
  };
    readonly "verdict": "pass" | "fail" | "incomplete";
  };
export type PerfProjectMix = {
    readonly "schema_version": "perf_project_mix_v1";
    readonly "mix_id": string;
    readonly "mix_revision": number;
    readonly "purpose": string;
    readonly "k_scenarios": readonly (string)[];
    readonly "seed": number;
    readonly "canvas": {
    readonly "width": number;
    readonly "height": number;
    readonly "fps": number;
  };
    readonly "duration_seconds": number;
    readonly "asset_classes": readonly ({
    readonly "class_id": string;
    readonly "kind": "image" | "gif" | "video" | "audio";
    readonly "mime_type": string;
    readonly "count": number;
    readonly "size_bytes": number;
    readonly "width"?: number;
    readonly "height"?: number;
    readonly "frame_count"?: number;
    readonly "duration_seconds"?: number;
  })[];
    readonly "scene_groups": readonly ({
    readonly "group_id": string;
    readonly "scene_count": number;
    readonly "scene_seconds": number;
    readonly "layers": readonly ({
    readonly "kind": "text" | "shape" | "clip" | "motion_instance";
    readonly "count": number;
    readonly "asset_class"?: string;
    readonly "animations_per_layer": number;
  })[];
  })[];
    readonly "project_layers": {
    readonly "overlays": number;
    readonly "caption_tracks": number;
    readonly "audio_placements": readonly ({
    readonly "role": "narration" | "music" | "sfx";
    readonly "count": number;
    readonly "asset_class": string;
  })[];
  };
    readonly "expected": {
    readonly "scene_count": number;
    readonly "layer_count": number;
    readonly "max_layers_in_scene": number;
    readonly "total_frames": number;
    readonly "distinct_asset_count": number;
    readonly "original_bytes": number;
    readonly "decoded_pixels_worst_case": number;
    readonly "assets_over_preview_budget": number;
  };
  };
export type PerfThresholds = {
    readonly "schema_version": "perf_thresholds_v1";
    readonly "thresholds_id": string;
    readonly "thresholds_revision": number;
    readonly "status": "frozen";
    readonly "frozen_at": unknown;
    readonly "supersedes"?: {
    readonly "revision": number;
    readonly "reason": string;
  };
    readonly "statement": string;
    readonly "metrics": readonly ({
    readonly "metric_id": string;
    readonly "surface": "editor" | "delivery" | "catalog" | "username" | "community" | "api" | "worker";
    readonly "title": string;
    readonly "k_scenarios": readonly (string)[];
    readonly "unit": "ms" | "s" | "bytes" | "mib" | "megapixels" | "count" | "ratio" | "percent" | "percent_per_hour" | "queries_per_request";
    readonly "statistic": "p50" | "p95" | "p99" | "max" | "min" | "count" | "ratio" | "growth";
    readonly "gate": boolean;
    readonly "source": {
    readonly "kind": "prometheus" | "harness" | "not_instrumented";
    readonly "name"?: string;
    readonly "route"?: string;
    readonly "gap"?: string;
  };
    readonly "basis": "plan_candidate" | "exact_requirement" | "agent_proposed_candidate";
    readonly "basis_note": string;
    readonly "bounds": readonly ({
    readonly "device_profile": string;
    readonly "temperature": "cold" | "warm" | "soak" | "any";
    readonly "operator": "<=" | ">=" | "==";
    readonly "value": number;
  })[];
  })[];
  };

export const reader = new ContractPackageReader({
  package: "perf-measurement",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
