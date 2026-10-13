// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/ops-evidence/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "autoscale-policy.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ops-evidence/v1/autoscale-policy.schema.json",
    "title": "ops_autoscale_policy_v1",
    "description": "The frozen policy of FAZ-07 P07-03 (Queue ve autoscale): how each clause of the task line is evidenced (a static check of the manifests, an existing test, a new test, a DEV drill or a named gap), the replica-ownership and signal-coverage findings that exist today (a ratchet: a new finding fails the test, a fixed one is removed with a new revision), the fleet scale cap at the design maximum, the provider-lane mapping and the DEV drills. It reads the repository only: nothing here is a cluster fact or a measurement.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "policy_id",
      "policy_revision",
      "status",
      "frozen_at",
      "statement",
      "requirements",
      "baseline_findings",
      "scale_cap",
      "provider_lane_groups",
      "drills"
    ],
    "properties": {
      "schema_version": {
        "const": "ops_autoscale_policy_v1"
      },
      "policy_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "policy_revision": {
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
        "maxLength": 1200
      },
      "requirements": {
        "description": "One entry per clause of the P07-03 task line.",
        "type": "array",
        "minItems": 1,
        "maxItems": 16,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "requirement_id",
            "clause",
            "evidence"
          ],
          "properties": {
            "requirement_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "clause": {
              "type": "string",
              "minLength": 1,
              "maxLength": 300
            },
            "evidence": {
              "type": "array",
              "minItems": 1,
              "maxItems": 8,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "ref"
                ],
                "properties": {
                  "kind": {
                    "description": "static_check: a check of scripts/ops_evidence/autoscale.py; test: an existing or new test (file and name are verified); dev_drill: a drill of this policy; gap: nothing evidences it yet and the note says who owns it.",
                    "enum": [
                      "static_check",
                      "test",
                      "dev_drill",
                      "gap"
                    ]
                  },
                  "ref": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 200
                  },
                  "file": {
                    "description": "test only: repository path of the test file.",
                    "type": "string",
                    "pattern": "^[A-Za-z0-9_./-]{3,200}$"
                  },
                  "note": {
                    "type": "string",
                    "maxLength": 400
                  }
                }
              }
            }
          }
        }
      },
      "baseline_findings": {
        "description": "Findings of the static check that exist at freeze time, per capacity profile. A finding not listed is new and fails the test; a listed finding that disappeared is fixed and is removed in a new revision.",
        "type": "array",
        "maxItems": 16,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "profile_id",
            "finding",
            "queues",
            "note"
          ],
          "properties": {
            "profile_id": {
              "enum": [
                "dev_effective",
                "base_declared"
              ]
            },
            "finding": {
              "enum": [
                "replicas_declared_under_autoscaler",
                "schedule_to_start_uncovered",
                "ephemeral_storage_undeclared"
              ]
            },
            "queues": {
              "type": "array",
              "minItems": 1,
              "maxItems": 40,
              "uniqueItems": true,
              "items": {
                "type": "string",
                "pattern": "^[pq][01]?-[a-z0-9-]{2,60}$"
              }
            },
            "note": {
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            }
          }
        }
      },
      "scale_cap": {
        "description": "The fleet that the KEDA maxima describe (every worker lane at its effective maximum replicas). The ratchet is the design maximum at freeze time: raising a maxReplicaCount, a request or a limit needs a new revision with a cost reason. Hourly cost needs operator unit prices (none exist in the repository).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "profile_id",
          "ratchet",
          "basis",
          "basis_note",
          "cost_inputs"
        ],
        "properties": {
          "profile_id": {
            "enum": [
              "dev_effective",
              "base_declared"
            ]
          },
          "ratchet": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "pods",
              "cpu_request_cores",
              "cpu_limit_cores",
              "memory_request_gib",
              "memory_limit_gib",
              "ephemeral_storage_limit_gib"
            ],
            "properties": {
              "pods": {
                "type": "number",
                "minimum": 0
              },
              "cpu_request_cores": {
                "type": "number",
                "minimum": 0
              },
              "cpu_limit_cores": {
                "type": "number",
                "minimum": 0
              },
              "memory_request_gib": {
                "type": "number",
                "minimum": 0
              },
              "memory_limit_gib": {
                "type": "number",
                "minimum": 0
              },
              "ephemeral_storage_limit_gib": {
                "type": "number",
                "minimum": 0
              }
            }
          },
          "basis": {
            "$ref": "common.schema.json#/$defs/Basis"
          },
          "basis_note": {
            "type": "string",
            "minLength": 1,
            "maxLength": 400
          },
          "cost_inputs": {
            "description": "The operator-supplied snapshot keys the hourly cost needs.",
            "type": "array",
            "minItems": 1,
            "maxItems": 8,
            "uniqueItems": true,
            "items": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{2,63}$"
            }
          }
        }
      },
      "provider_lane_groups": {
        "description": "Which provider group each provider-bound worker lane serves: the lane capacity at its maximum is compared with the provider limit of the group (adding pods above the provider limit adds no capacity).",
        "type": "object",
        "maxProperties": 16,
        "propertyNames": {
          "pattern": "^[pq][01]?-[a-z0-9-]{2,60}$"
        },
        "additionalProperties": {
          "enum": [
            "llm",
            "stt",
            "tts",
            "image",
            "video"
          ]
        }
      },
      "drills": {
        "description": "The DEV drills the plan runs. The DEV worker ScaledObjects are pinned to min=max=1, so a scale drill needs the operator to raise one lane's maximum for the drill (a DEV change the operator makes and reverts; this slice edits no manifest).",
        "type": "array",
        "minItems": 1,
        "maxItems": 12,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "drill_id",
            "title",
            "requirements",
            "operator_prerequisite",
            "steps",
            "expected"
          ],
          "properties": {
            "drill_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "requirements": {
              "type": "array",
              "minItems": 1,
              "maxItems": 6,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/ProfileId"
              }
            },
            "operator_prerequisite": {
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            },
            "steps": {
              "type": "array",
              "minItems": 1,
              "maxItems": 10,
              "items": {
                "type": "string",
                "minLength": 1,
                "maxLength": 300
              }
            },
            "expected": {
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            }
          }
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "policy_revision": {
              "minimum": 2
            }
          },
          "required": [
            "policy_revision"
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
  },
  "cache-pack.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ops-evidence/v1/cache-pack.schema.json",
    "title": "ops_cache_pack_v1",
    "description": "The frozen pack of FAZ-07 P07-15 (cross-surface ordinary-cache and fault evidence): the cache and stream configuration that is measured (frozen before any measurement and bound to the code that owns it), the scenario sizes and surfaces of the measured local report, the fixtures K179-K190 with their evidence (local tests, DEV scenarios or named gaps) and the findings the local report already shows (a ratchet). It is a measured report of counts, bytes and virtual milliseconds, never a latency guarantee.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "pack_id",
      "pack_revision",
      "status",
      "frozen_at",
      "statement",
      "class_policies",
      "engine_defaults",
      "surface_configs",
      "stream",
      "parameters",
      "surfaces",
      "fixtures",
      "local_metrics",
      "known_findings",
      "dev_scenarios"
    ],
    "properties": {
      "schema_version": {
        "const": "ops_cache_pack_v1"
      },
      "pack_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "pack_revision": {
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
        "maxLength": 1500
      },
      "class_policies": {
        "description": "DEFAULT_SCOPED_CACHE_CLASS_POLICIES of the shared engine (the test imports the code and compares).",
        "type": "array",
        "minItems": 4,
        "maxItems": 4,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "class_id",
            "ttl_ms",
            "jitter_ratio",
            "max_ttl_ms",
            "max_entry_bytes"
          ],
          "properties": {
            "class_id": {
              "enum": [
                "mutable_metadata",
                "immutable_body",
                "session_projection",
                "authoritative_negative"
              ]
            },
            "ttl_ms": {
              "type": "integer",
              "minimum": 1
            },
            "jitter_ratio": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            "max_ttl_ms": {
              "type": "integer",
              "minimum": 1
            },
            "max_entry_bytes": {
              "type": "integer",
              "minimum": 1
            }
          }
        }
      },
      "engine_defaults": {
        "description": "Private constants of the engine: bound by a source pattern (`cache check`).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "store_op_timeout_ms",
          "lease_ttl_ms",
          "lease_wait_ms",
          "lease_poll_ms",
          "bindings"
        ],
        "properties": {
          "store_op_timeout_ms": {
            "type": "integer",
            "minimum": 1
          },
          "lease_ttl_ms": {
            "type": "integer",
            "minimum": 1
          },
          "lease_wait_ms": {
            "type": "integer",
            "minimum": 0
          },
          "lease_poll_ms": {
            "type": "integer",
            "minimum": 1
          },
          "bindings": {
            "$ref": "#/$defs/Bindings"
          }
        }
      },
      "surface_configs": {
        "description": "The effective start configuration of every scoped cache engine of the gateway. Unmeasured start values of the code, frozen here; a change is a new revision.",
        "type": "array",
        "minItems": 1,
        "maxItems": 8,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "config_id",
            "source_max_concurrent",
            "source_max_wait_ms",
            "breaker_failures",
            "breaker_open_ms",
            "partition_max_bytes",
            "partition_window_ms",
            "bindings"
          ],
          "properties": {
            "config_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "source_max_concurrent": {
              "type": "integer",
              "minimum": 1
            },
            "source_max_wait_ms": {
              "type": "integer",
              "minimum": 0
            },
            "breaker_failures": {
              "type": "integer",
              "minimum": 1
            },
            "breaker_open_ms": {
              "type": "integer",
              "minimum": 1
            },
            "partition_max_bytes": {
              "type": "integer",
              "minimum": 1
            },
            "partition_window_ms": {
              "type": "integer",
              "minimum": 1
            },
            "loader_timeout_ms": {
              "type": "integer",
              "minimum": 1
            },
            "bindings": {
              "$ref": "#/$defs/Bindings"
            }
          }
        }
      },
      "stream": {
        "description": "The durable stream scheduler cadence that bounds the delivery of a terminal event whose publish was lost.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "page_size",
          "max_pages_per_drain",
          "repair_intervals_ms",
          "jitter_ratio",
          "resync_jitter_ms",
          "fallback_retry_ms",
          "bindings"
        ],
        "properties": {
          "page_size": {
            "type": "integer",
            "minimum": 1
          },
          "max_pages_per_drain": {
            "type": "integer",
            "minimum": 1
          },
          "repair_intervals_ms": {
            "type": "array",
            "minItems": 1,
            "maxItems": 6,
            "items": {
              "type": "integer",
              "minimum": 1
            }
          },
          "jitter_ratio": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "resync_jitter_ms": {
            "type": "integer",
            "minimum": 0
          },
          "fallback_retry_ms": {
            "type": "integer",
            "minimum": 1
          },
          "bindings": {
            "$ref": "#/$defs/Bindings"
          }
        }
      },
      "parameters": {
        "description": "Scenario sizes of the measured local report (fixed before measuring).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "warm_reads",
          "cold_same_key_concurrency",
          "fleet_processes",
          "fleet_same_key_concurrency",
          "distinct_cold_keys",
          "outage_reads_after_open",
          "page_sizes",
          "loader_delay_ms"
        ],
        "properties": {
          "warm_reads": {
            "type": "integer",
            "minimum": 1
          },
          "cold_same_key_concurrency": {
            "type": "integer",
            "minimum": 2
          },
          "fleet_processes": {
            "type": "integer",
            "minimum": 2
          },
          "fleet_same_key_concurrency": {
            "type": "integer",
            "minimum": 1
          },
          "distinct_cold_keys": {
            "type": "integer",
            "minimum": 2
          },
          "outage_reads_after_open": {
            "type": "integer",
            "minimum": 1
          },
          "page_sizes": {
            "type": "array",
            "minItems": 2,
            "maxItems": 6,
            "items": {
              "type": "integer",
              "minimum": 1
            }
          },
          "loader_delay_ms": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "surfaces": {
        "type": "array",
        "minItems": 1,
        "maxItems": 12,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "surface_id",
            "title",
            "config_id",
            "driver",
            "namespaces"
          ],
          "properties": {
            "surface_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 160
            },
            "config_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "driver": {
              "description": "adapter: the real surface adapter runs in the measured report; engine: the surface's real engine and fence shape (its adapter needs a whole harness and has its own budget test).",
              "enum": [
                "adapter",
                "engine"
              ]
            },
            "adapter": {
              "type": "string",
              "minLength": 1,
              "maxLength": 120
            },
            "namespaces": {
              "type": "array",
              "minItems": 1,
              "maxItems": 16,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "namespace",
                  "file"
                ],
                "properties": {
                  "namespace": {
                    "type": "string",
                    "pattern": "^[a-z][a-z0-9_.]{2,80}$"
                  },
                  "file": {
                    "type": "string",
                    "pattern": "^[A-Za-z0-9_./-]{3,200}$"
                  }
                }
              }
            }
          }
        }
      },
      "fixtures": {
        "description": "The named fixtures of the task line (scope collision/late fill, cold-start miss fan-out, Redis outage, replica lag, SSE lost terminal, per-session presence) plus the measurements of the decision's section 7.",
        "type": "array",
        "minItems": 1,
        "maxItems": 24,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "fixture_id",
            "title",
            "k_scenarios",
            "surfaces",
            "measures",
            "evidence"
          ],
          "properties": {
            "fixture_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
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
            "surfaces": {
              "type": "array",
              "minItems": 1,
              "maxItems": 12,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/ProfileId"
              }
            },
            "measures": {
              "description": "Metric ids of the thresholds this fixture feeds (may be empty when the fixture is evidenced by existing tests only).",
              "type": "array",
              "maxItems": 12,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/MetricId"
              }
            },
            "evidence": {
              "$ref": "#/$defs/Evidence"
            }
          }
        }
      },
      "local_metrics": {
        "description": "The metrics the measured local report records (exactly these, no more, no fewer).",
        "type": "array",
        "minItems": 1,
        "maxItems": 40,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/MetricId"
        }
      },
      "known_findings": {
        "description": "Findings the measured local report already shows. The ratchet: a measured value that grows fails the test; a fix retires the finding in a new revision.",
        "type": "array",
        "maxItems": 12,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "finding_id",
            "surface",
            "metric_id",
            "measured",
            "note"
          ],
          "properties": {
            "finding_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "surface": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "metric_id": {
              "$ref": "common.schema.json#/$defs/MetricId"
            },
            "measured": {
              "type": "number"
            },
            "note": {
              "type": "string",
              "minLength": 1,
              "maxLength": 600
            }
          }
        }
      },
      "dev_scenarios": {
        "type": "array",
        "minItems": 1,
        "maxItems": 8,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "scenario_id",
            "title",
            "fixtures",
            "operator_prerequisite",
            "steps",
            "expected",
            "never"
          ],
          "properties": {
            "scenario_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "fixtures": {
              "type": "array",
              "minItems": 1,
              "maxItems": 12,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/ProfileId"
              }
            },
            "operator_prerequisite": {
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            },
            "steps": {
              "type": "array",
              "minItems": 1,
              "maxItems": 12,
              "items": {
                "type": "string",
                "minLength": 1,
                "maxLength": 300
              }
            },
            "expected": {
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            },
            "never": {
              "type": "string",
              "minLength": 1,
              "maxLength": 400
            }
          }
        }
      }
    },
    "$defs": {
      "Bindings": {
        "description": "Where the frozen numbers live in the code: the first capture group of `pattern`, read as an integer (underscores and products such as 16 * 1024 allowed), must equal `expected` (`cache check`).",
        "type": "array",
        "minItems": 1,
        "maxItems": 24,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "file",
            "pattern",
            "expected"
          ],
          "properties": {
            "file": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_./-]{3,200}$"
            },
            "pattern": {
              "type": "string",
              "minLength": 3,
              "maxLength": 300
            },
            "expected": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      },
      "Evidence": {
        "type": "array",
        "minItems": 1,
        "maxItems": 14,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "ref"
          ],
          "properties": {
            "kind": {
              "description": "local_test: a test (the measured pack itself or an existing one; file and name are verified); dev_scenario: a scenario of this pack; gap: what is not covered and who owns it.",
              "enum": [
                "local_test",
                "dev_scenario",
                "gap"
              ]
            },
            "ref": {
              "type": "string",
              "minLength": 1,
              "maxLength": 300
            },
            "runner": {
              "enum": [
                "pytest",
                "vitest"
              ]
            },
            "file": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_./-]{3,200}$"
            },
            "needs_infra": {
              "type": "boolean"
            },
            "note": {
              "type": "string",
              "maxLength": 500
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "kind": {
                    "const": "local_test"
                  }
                },
                "required": [
                  "kind"
                ]
              },
              "then": {
                "required": [
                  "runner",
                  "file",
                  "needs_infra"
                ]
              },
              "else": {
                "not": {
                  "anyOf": [
                    {
                      "required": [
                        "runner"
                      ]
                    },
                    {
                      "required": [
                        "file"
                      ]
                    },
                    {
                      "required": [
                        "needs_infra"
                      ]
                    }
                  ]
                }
              }
            },
            {
              "if": {
                "properties": {
                  "kind": {
                    "const": "gap"
                  }
                },
                "required": [
                  "kind"
                ]
              },
              "then": {
                "required": [
                  "note"
                ]
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
            "pack_revision": {
              "minimum": 2
            }
          },
          "required": [
            "pack_revision"
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
  },
  "capacity-model.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ops-evidence/v1/capacity-model.schema.json",
    "title": "ops_capacity_model_v1",
    "description": "The capacity model of FAZ-07 P07-01 (Kapasite modeli): concurrent users are never equated with worker count. Active runs, runnable shots, provider in-flight and requests per minute, tenant permits (general, short and export lane), planner slots, worker lane slots, decode/render CPU and Storage throughput are separate dimensions with their own ceiling and their own measurement series. A job class states which dimensions one job occupies and for how long; the calculator applies the arrival-rate template L = lambda x service time per dimension (FAZ-07 'Kapasite hesaplama sablonu'). Every service time and rate in the model is an unmeasured assumption or a quoted small DEV sample (ValueBasis), never a result: the model sizes ceilings against assumptions to find where backpressure must appear, it never announces a pod count.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "model_id",
      "model_revision",
      "status",
      "frozen_at",
      "statement",
      "utilisation",
      "scale_reaction",
      "capacity_profiles",
      "dimensions",
      "job_classes"
    ],
    "properties": {
      "schema_version": {
        "const": "ops_capacity_model_v1"
      },
      "model_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "model_revision": {
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
        "maxLength": 1200
      },
      "utilisation": {
        "description": "A dimension whose planned utilisation (demand / ceiling) is at most target is within; above target and at most limit it is near the limit; above limit it exceeds (the scenario must declare the backpressure it expects there).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "target",
          "limit",
          "basis",
          "basis_note"
        ],
        "properties": {
          "target": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 1
          },
          "limit": {
            "const": 1
          },
          "basis": {
            "$ref": "common.schema.json#/$defs/Basis"
          },
          "basis_note": {
            "type": "string",
            "minLength": 1,
            "maxLength": 400
          }
        }
      },
      "scale_reaction": {
        "description": "How long a burst waits for scale-out: KEDA polling (read from the queue contract, so P07-16's 30 s to 5-10 s change shows up) plus the HPA sync and the pod start. Only used to size the queue that forms before extra replicas exist.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "hpa_sync_seconds",
          "pod_ready_seconds",
          "note"
        ],
        "properties": {
          "hpa_sync_seconds": {
            "$ref": "#/$defs/SeededNumber"
          },
          "pod_ready_seconds": {
            "$ref": "#/$defs/SeededNumber"
          },
          "note": {
            "type": "string",
            "minLength": 1,
            "maxLength": 400
          }
        }
      },
      "capacity_profiles": {
        "description": "Which manifests the worker lane ceilings are read from. dev_effective is the DEV overlay as rendered (every worker ScaledObject is pinned); base_declared is the base KEDA bounds, the design ceiling a production-like environment would allow.",
        "type": "array",
        "minItems": 1,
        "maxItems": 4,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "profile_id",
            "source",
            "description"
          ],
          "properties": {
            "profile_id": {
              "enum": [
                "dev_effective",
                "base_declared"
              ]
            },
            "source": {
              "description": "Repository path of the kustomization the profile is rendered from.",
              "type": "string",
              "pattern": "^[A-Za-z0-9_./-]{3,200}$"
            },
            "description": {
              "type": "string",
              "minLength": 1,
              "maxLength": 400
            }
          }
        }
      },
      "dimensions": {
        "type": "array",
        "minItems": 1,
        "maxItems": 24,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "dimension_id",
            "title",
            "unit",
            "scope",
            "demand_kind",
            "ceiling",
            "observe"
          ],
          "properties": {
            "dimension_id": {
              "$ref": "common.schema.json#/$defs/DimensionId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "unit": {
              "$ref": "common.schema.json#/$defs/Unit"
            },
            "scope": {
              "description": "tenant: the ceiling applies to each tenant separately; fleet: one ceiling for everything.",
              "enum": [
                "tenant",
                "fleet"
              ]
            },
            "demand_kind": {
              "description": "occupancy: arrival rate x units x hold time (Little); rate_per_second / rate_per_minute: arrival rate x units.",
              "enum": [
                "occupancy",
                "rate_per_second",
                "rate_per_minute"
              ]
            },
            "keyed_by": {
              "description": "The key a footprint must name (a provider group or a task queue); each key has its own ceiling.",
              "enum": [
                "provider_group",
                "queue"
              ]
            },
            "ceiling": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind"
              ],
              "properties": {
                "kind": {
                  "enum": [
                    "plan_default",
                    "code_constant",
                    "code_constant_times_snapshot",
                    "lane_slots",
                    "lane_cpu_limit_sum",
                    "operator_snapshot",
                    "none_declared"
                  ]
                },
                "plan_key": {
                  "description": "plan_default: the Feature Control plan key whose default is the per-tenant ceiling (api-gateway plan-seed-defaults.ts).",
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]{2,63}$"
                },
                "file": {
                  "description": "code_constant*: repository path of the source file.",
                  "type": "string",
                  "pattern": "^[A-Za-z0-9_./-]{3,200}$"
                },
                "pattern": {
                  "description": "code_constant*: regular expression with exactly one capture group that yields the constant in the file.",
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 200
                },
                "value": {
                  "description": "code_constant*: the value the pattern must yield (drift is a test failure).",
                  "type": "number",
                  "minimum": 0
                },
                "snapshot_key": {
                  "description": "code_constant_times_snapshot / operator_snapshot: the key of the operator snapshot that supplies the missing factor or the ceiling.",
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]{2,63}$"
                },
                "queues": {
                  "description": "lane_cpu_limit_sum: the worker lanes whose CPU limits add up (at their effective maximum replicas).",
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 16,
                  "uniqueItems": true,
                  "items": {
                    "type": "string",
                    "pattern": "^[pq][01]?-[a-z0-9-]{2,60}$"
                  }
                },
                "gap": {
                  "description": "none_declared: why no ceiling is declared and who owns the decision.",
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
                        "const": "plan_default"
                      }
                    },
                    "required": [
                      "kind"
                    ]
                  },
                  "then": {
                    "required": [
                      "plan_key"
                    ]
                  }
                },
                {
                  "if": {
                    "properties": {
                      "kind": {
                        "const": "code_constant"
                      }
                    },
                    "required": [
                      "kind"
                    ]
                  },
                  "then": {
                    "required": [
                      "file",
                      "pattern",
                      "value"
                    ]
                  }
                },
                {
                  "if": {
                    "properties": {
                      "kind": {
                        "const": "code_constant_times_snapshot"
                      }
                    },
                    "required": [
                      "kind"
                    ]
                  },
                  "then": {
                    "required": [
                      "file",
                      "pattern",
                      "value",
                      "snapshot_key"
                    ]
                  }
                },
                {
                  "if": {
                    "properties": {
                      "kind": {
                        "const": "lane_cpu_limit_sum"
                      }
                    },
                    "required": [
                      "kind"
                    ]
                  },
                  "then": {
                    "required": [
                      "queues"
                    ]
                  }
                },
                {
                  "if": {
                    "properties": {
                      "kind": {
                        "const": "operator_snapshot"
                      }
                    },
                    "required": [
                      "kind"
                    ]
                  },
                  "then": {
                    "required": [
                      "snapshot_key"
                    ]
                  }
                },
                {
                  "if": {
                    "properties": {
                      "kind": {
                        "const": "none_declared"
                      }
                    },
                    "required": [
                      "kind"
                    ]
                  },
                  "then": {
                    "required": [
                      "gap"
                    ]
                  }
                }
              ]
            },
            "observe": {
              "description": "The series a DEV run reads to observe this dimension (its own peak, separately from the others).",
              "type": "array",
              "minItems": 1,
              "maxItems": 6,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "name"
                ],
                "properties": {
                  "kind": {
                    "enum": [
                      "prometheus",
                      "platform_prometheus",
                      "harness"
                    ]
                  },
                  "name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 120
                  },
                  "note": {
                    "type": "string",
                    "maxLength": 300
                  }
                }
              }
            }
          }
        }
      },
      "job_classes": {
        "type": "array",
        "minItems": 1,
        "maxItems": 24,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "class_id",
            "title",
            "durations",
            "footprints"
          ],
          "properties": {
            "class_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "node_type": {
              "description": "The workflow-engine node type of the job. Absent for work that is not a workflow node (an assistant planner turn, a source upload).",
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]{2,63}$"
            },
            "node_inputs": {
              "description": "Inputs the lane classification reads (render mode and duration, a trim window). Never a real payload.",
              "type": "object",
              "maxProperties": 8
            },
            "impl_revision": {
              "type": "integer",
              "minimum": 1,
              "maximum": 99
            },
            "funding_channel": {
              "enum": [
                "app",
                "api",
                "mcp"
              ]
            },
            "interactive": {
              "type": "boolean"
            },
            "capacity_class": {
              "description": "The reserved lane the job takes (workflow-engine capacity_lane_policy.capacity_class_for; the classification is a tested fact, not a definition). none: not a workflow node.",
              "enum": [
                "general",
                "short",
                "export",
                "none"
              ]
            },
            "queue": {
              "description": "The Temporal task queue the node runs on (contracts/workflow-task-queues.json).",
              "type": "string",
              "pattern": "^[pq][01]?-[a-z0-9-]{2,60}$"
            },
            "provider_group": {
              "enum": [
                "llm",
                "stt",
                "tts",
                "image",
                "video"
              ]
            },
            "durations": {
              "description": "How long one job holds each kind of resource (seconds). A key is present only when a footprint uses it.",
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "run": {
                  "$ref": "#/$defs/SeededNumber"
                },
                "permit": {
                  "$ref": "#/$defs/SeededNumber"
                },
                "node": {
                  "$ref": "#/$defs/SeededNumber"
                },
                "provider": {
                  "$ref": "#/$defs/SeededNumber"
                },
                "cpu": {
                  "$ref": "#/$defs/SeededNumber"
                }
              }
            },
            "footprints": {
              "type": "array",
              "minItems": 1,
              "maxItems": 12,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "dimension_id",
                  "units",
                  "hold"
                ],
                "properties": {
                  "dimension_id": {
                    "$ref": "common.schema.json#/$defs/DimensionId"
                  },
                  "key": {
                    "description": "The provider group or the queue of a keyed dimension.",
                    "type": "string",
                    "pattern": "^[a-z0-9-]{2,60}$"
                  },
                  "units": {
                    "description": "Units of the dimension one job occupies (slots, cores, requests, megabits).",
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  "hold": {
                    "description": "Which duration of the class multiplies the units (occupancy dimensions), or per_job for the rate dimensions.",
                    "enum": [
                      "run",
                      "permit",
                      "node",
                      "provider",
                      "cpu",
                      "per_job"
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    "$defs": {
      "SeededNumber": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "value",
          "basis"
        ],
        "properties": {
          "value": {
            "type": "number",
            "exclusiveMinimum": 0
          },
          "basis": {
            "$ref": "common.schema.json#/$defs/ValueBasis"
          },
          "note": {
            "type": "string",
            "maxLength": 300
          }
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "model_revision": {
              "minimum": 2
            }
          },
          "required": [
            "model_revision"
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
  },
  "capacity-scenario.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ops-evidence/v1/capacity-scenario.schema.json",
    "title": "ops_capacity_scenario_v1",
    "description": "One workload of the P07-01 capacity model: who is on the system (tenant groups with a plan and the users per tenant), how many of them are active, which job classes they submit at what rate, the ramp of concurrent users (FAZ-07: 1/10/30/50) and the backpressure the model expects at the top of the ramp. The multi-tenant and the single-tenant/many-user shapes are separate scenarios because the tenant-scoped ceilings (permits, planner slots) bind differently. A scenario is a definition fixed before any run; its rates are assumptions (ValueBasis), never measured behaviour.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "scenario_id",
      "scenario_revision",
      "title",
      "model",
      "k_scenarios",
      "tenant_groups",
      "ramp_users",
      "active_fraction",
      "workload",
      "capacity_profiles",
      "expected_backpressure"
    ],
    "properties": {
      "schema_version": {
        "const": "ops_capacity_scenario_v1"
      },
      "scenario_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "scenario_revision": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "description": {
        "type": "string",
        "maxLength": 1200
      },
      "model": {
        "$ref": "common.schema.json#/$defs/VersionedRef"
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
      "tenant_groups": {
        "description": "Users are apportioned to the groups by weight (largest remainder, ties to the first group); a group's tenants are its users divided by users_per_tenant, rounded up.",
        "type": "array",
        "minItems": 1,
        "maxItems": 5,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "group_id",
            "plan",
            "weight",
            "users_per_tenant"
          ],
          "properties": {
            "group_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "plan": {
              "enum": [
                "basic",
                "starter",
                "pro",
                "max",
                "enterprise"
              ]
            },
            "weight": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100
            },
            "users_per_tenant": {
              "type": "integer",
              "minimum": 1,
              "maximum": 1000
            }
          }
        }
      },
      "ramp_users": {
        "description": "Concurrent users at each ramp step, ascending.",
        "type": "array",
        "minItems": 1,
        "maxItems": 8,
        "uniqueItems": true,
        "items": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000
        }
      },
      "active_fraction": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "value",
          "basis"
        ],
        "properties": {
          "value": {
            "description": "Share of the connected users that submit work in the measured window.",
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 1
          },
          "basis": {
            "$ref": "common.schema.json#/$defs/ValueBasis"
          },
          "note": {
            "type": "string",
            "maxLength": 300
          }
        }
      },
      "workload": {
        "type": "array",
        "minItems": 1,
        "maxItems": 24,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "class_id",
            "per_active_user_per_hour",
            "basis"
          ],
          "properties": {
            "class_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "per_active_user_per_hour": {
              "type": "number",
              "minimum": 0,
              "maximum": 3600
            },
            "burst_per_tenant": {
              "description": "Jobs of the class that arrive in the same instant in one tenant (a 60-shot storyboard submitted at once). Tested separately from the steady rate (FAZ-07).",
              "type": "integer",
              "minimum": 0,
              "maximum": 500
            },
            "basis": {
              "$ref": "common.schema.json#/$defs/ValueBasis"
            }
          }
        }
      },
      "capacity_profiles": {
        "type": "array",
        "minItems": 1,
        "maxItems": 2,
        "uniqueItems": true,
        "items": {
          "enum": [
            "dev_effective",
            "base_declared"
          ]
        }
      },
      "expected_backpressure": {
        "description": "The dimensions whose planned utilisation must exceed the limit at the top of the ramp, per profile. Backpressure there is designed behaviour (a visible queue reason, a wait), not a failure; a dimension that exceeds without being declared, or is declared but does not, fails the model test. Only dimensions with a resolved ceiling are listed; a ceiling that needs an operator snapshot is judged when the snapshot is given.",
        "type": "array",
        "maxItems": 64,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "profile_id",
            "dimension_id"
          ],
          "properties": {
            "profile_id": {
              "enum": [
                "dev_effective",
                "base_declared"
              ]
            },
            "dimension_id": {
              "$ref": "common.schema.json#/$defs/DimensionId"
            },
            "key": {
              "type": "string",
              "pattern": "^[a-z0-9-]{2,60}$"
            },
            "queue_reason": {
              "description": "The visible reason the user or operator sees at that point (an existing queue_reason of the runtime, or the gap when none exists).",
              "type": "string",
              "maxLength": 200
            }
          }
        }
      }
    }
  },
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ops-evidence/v1/common.schema.json",
    "title": "ops_evidence_common_v1",
    "description": "Shared definitions of the ops-evidence v1 package (FAZ-07 P07-01/03/05/08/15 first slices: what a capacity, autoscale, fault-injection, cache-fault or operations campaign needs before anything is run on DEV: versioned definitions, thresholds frozen before measuring, a dry-run harness plan and how a run is recorded). Not a standalone document type. Hashes and timestamps are owned by assistant-runtime v1.",
    "$defs": {
      "ProfileId": {
        "description": "Kebab-case id of a versioned definition (model, scenario, thresholds, plan, run, drill).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]{2,63}$"
      },
      "DimensionId": {
        "description": "Snake_case id of a capacity dimension (the same spelling as the plan keys and series it is bound to).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{2,63}$"
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
        "description": "area.name[.qualifier...]: lower snake_case segments separated by dots.",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*){1,4}$"
      },
      "KScenario": {
        "type": "string",
        "pattern": "^K[0-9]{2,3}[a-z]?$"
      },
      "Campaign": {
        "description": "capacity: P07-01 model and load ramps; queue_autoscale: P07-03; fault_injection: P07-05; cache_fault: P07-15; operations_soak: P07-08.",
        "enum": [
          "capacity",
          "queue_autoscale",
          "fault_injection",
          "cache_fault",
          "operations_soak"
        ]
      },
      "Unit": {
        "enum": [
          "ms",
          "s",
          "bytes",
          "mib",
          "mbps",
          "count",
          "ratio",
          "percent",
          "queries_per_request",
          "slots",
          "cores",
          "per_second",
          "per_minute",
          "credits"
        ]
      },
      "Statistic": {
        "description": "p50/p95/p99 are nearest-rank percentiles of the samples; max/min/mean/last are what they say; sum is the total of per-window counts (a violation count is a sum).",
        "enum": [
          "p50",
          "p95",
          "p99",
          "max",
          "min",
          "mean",
          "sum",
          "last"
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
        "description": "prometheus: a series exported by code in this repository (its name is checked against the metric sources); platform_prometheus: a series of a platform exporter (kubelet/cAdvisor, kube-state-metrics, Temporal server, CNPG) that this repository does not define; harness: a load-driver or test-harness measurement; model: a deterministic output of the capacity calculator; not_instrumented: nothing measures it yet and the instrumentation gap is named, so a run that needs it can only record not_measured.",
        "enum": [
          "prometheus",
          "platform_prometheus",
          "harness",
          "model",
          "not_instrumented"
        ]
      },
      "Basis": {
        "description": "Where a frozen number comes from. exact_requirement: a decision states the exact value (0/1 invariants and named limits); plan_candidate: written in the plan documents as a candidate; agent_proposed_candidate: proposed by the implementation slice before any measurement and awaiting owner confirmation. None of them is a measured result.",
        "enum": [
          "exact_requirement",
          "plan_candidate",
          "agent_proposed_candidate"
        ]
      },
      "ValueBasis": {
        "description": "Where an input number of a model comes from. assumed_unmeasured: an assumption of the implementation slice; coordinator_dev_sample: a small read-only DEV sample quoted from the coordinator's 2026-09-29 latency analysis (not a measurement of this task); repo_config: read from a file of this repository (the binding is tested); operator_snapshot: supplied by the operator for the run (a provider limit, a replica count) and recorded with it.",
        "enum": [
          "assumed_unmeasured",
          "coordinator_dev_sample",
          "repo_config",
          "operator_snapshot"
        ]
      },
      "TargetEnvironment": {
        "description": "Where a run may execute. Production is deliberately not representable (AGENTS.md, Q102): no run and no record can name it.",
        "enum": [
          "local",
          "ci",
          "dev_cluster"
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
  "fault-catalog.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ops-evidence/v1/fault-catalog.schema.json",
    "title": "ops_fault_catalog_v1",
    "description": "The frozen fault catalog of FAZ-07 P07-05 (Fault injection): every fault the task line names, the invariants that must hold when it happens, and the evidence: local deterministic tests over the real code paths (fakes at the boundaries; file and test name are verified against the repository), scripted DEV scenarios the operator runs, or a named gap. The catalog is the map; the local runner executes its tests, the DEV scenarios feed the fault plan. It is not a measurement.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "catalog_id",
      "catalog_revision",
      "status",
      "frozen_at",
      "statement",
      "groups",
      "cases",
      "dev_scenarios"
    ],
    "properties": {
      "schema_version": {
        "const": "ops_fault_catalog_v1"
      },
      "catalog_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "catalog_revision": {
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
        "maxLength": 1500
      },
      "groups": {
        "description": "One group per clause of the P07-05 task line.",
        "type": "array",
        "minItems": 1,
        "maxItems": 24,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "group_id",
            "title",
            "clause"
          ],
          "properties": {
            "group_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 160
            },
            "clause": {
              "description": "The words of the task line this group answers.",
              "type": "string",
              "minLength": 1,
              "maxLength": 400
            }
          }
        }
      },
      "cases": {
        "type": "array",
        "minItems": 1,
        "maxItems": 80,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "case_id",
            "group_id",
            "surface",
            "title",
            "fault",
            "boundary",
            "requires_local",
            "k_scenarios",
            "invariants",
            "evidence"
          ],
          "properties": {
            "case_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "group_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "surface": {
              "enum": [
                "engine",
                "gateway",
                "provider",
                "billing",
                "storage",
                "assistant",
                "memory",
                "connector",
                "skill",
                "platform"
              ]
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "fault": {
              "description": "What is injected or what goes wrong.",
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            },
            "boundary": {
              "description": "Where the fake sits and which real code runs.",
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            },
            "requires_local": {
              "description": "true: a local deterministic test must exist (checked). false: only a cluster shows it (a pod kill, a deploy drain) and a DEV scenario carries it.",
              "type": "boolean"
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
            "invariants": {
              "type": "array",
              "minItems": 1,
              "maxItems": 8,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "invariant_id",
                  "statement"
                ],
                "properties": {
                  "invariant_id": {
                    "$ref": "common.schema.json#/$defs/ProfileId"
                  },
                  "statement": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 300
                  }
                }
              }
            },
            "evidence": {
              "type": "array",
              "minItems": 1,
              "maxItems": 12,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "ref"
                ],
                "properties": {
                  "kind": {
                    "description": "local_test: an existing or new test (file and name are verified); dev_scenario: a scenario of this catalog; gap: what no test or scenario covers yet, with its owner in the note.",
                    "enum": [
                      "local_test",
                      "dev_scenario",
                      "gap"
                    ]
                  },
                  "ref": {
                    "description": "local_test: the exact test name; dev_scenario: the scenario id; gap: a short id.",
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 300
                  },
                  "runner": {
                    "description": "local_test only.",
                    "enum": [
                      "pytest",
                      "vitest"
                    ]
                  },
                  "file": {
                    "description": "local_test only: repository path of the test file.",
                    "type": "string",
                    "pattern": "^[A-Za-z0-9_./-]{3,200}$"
                  },
                  "needs_infra": {
                    "description": "local_test only: true when the test needs a real Postgres, Redis or Temporal server (it is skipped by the default local run and reported as not run, never as a pass).",
                    "type": "boolean"
                  },
                  "note": {
                    "type": "string",
                    "maxLength": 500
                  }
                },
                "allOf": [
                  {
                    "if": {
                      "properties": {
                        "kind": {
                          "const": "local_test"
                        }
                      },
                      "required": [
                        "kind"
                      ]
                    },
                    "then": {
                      "required": [
                        "runner",
                        "file",
                        "needs_infra"
                      ]
                    },
                    "else": {
                      "not": {
                        "anyOf": [
                          {
                            "required": [
                              "runner"
                            ]
                          },
                          {
                            "required": [
                              "file"
                            ]
                          },
                          {
                            "required": [
                              "needs_infra"
                            ]
                          }
                        ]
                      }
                    }
                  },
                  {
                    "if": {
                      "properties": {
                        "kind": {
                          "const": "gap"
                        }
                      },
                      "required": [
                        "kind"
                      ]
                    },
                    "then": {
                      "required": [
                        "note"
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
      "dev_scenarios": {
        "description": "Scripted scenarios of the fault plan. The operator runs them on DEV with approval; they change the cluster only the way the operator chooses and this catalog edits no manifest.",
        "type": "array",
        "minItems": 1,
        "maxItems": 12,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "scenario_id",
            "title",
            "cases",
            "operator_prerequisite",
            "steps",
            "expected",
            "never"
          ],
          "properties": {
            "scenario_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "cases": {
              "type": "array",
              "minItems": 1,
              "maxItems": 12,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/ProfileId"
              }
            },
            "operator_prerequisite": {
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            },
            "steps": {
              "type": "array",
              "minItems": 1,
              "maxItems": 12,
              "items": {
                "type": "string",
                "minLength": 1,
                "maxLength": 300
              }
            },
            "expected": {
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            },
            "never": {
              "description": "What the scenario must never do (the safety limits of the scenario).",
              "type": "string",
              "minLength": 1,
              "maxLength": 400
            }
          }
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "catalog_revision": {
              "minimum": 2
            }
          },
          "required": [
            "catalog_revision"
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
  },
  "operations-pack.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ops-evidence/v1/operations-pack.schema.json",
    "title": "ops_operations_pack_v1",
    "description": "The frozen operations pack of FAZ-07 P07-08: for each of the five incidents (queue stuck, provider unknown outcome, approval expiry, orphan artifact, finance pending) the alerts, signals, mechanisms, local tests, named detection gaps and runbook sections that carry it plus one scripted alarm drill; the read-only backup/restore and project/ref consistency checks (SQL as data, run by the operator on a restored DEV database); the dashboard identity; and the 24 h DEV soak profile (sampling, load, series and how each series becomes a metric). Every reference is verified against the repository by `operations check`; nothing here is a measurement, a deployed alert or a database change. A local test report is not deployed evidence.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "pack_id",
      "pack_revision",
      "status",
      "frozen_at",
      "statement",
      "incidents",
      "drills",
      "dashboard",
      "consistency",
      "restore",
      "soak"
    ],
    "properties": {
      "schema_version": {
        "const": "ops_operations_pack_v1"
      },
      "pack_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "pack_revision": {
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
        "maxLength": 1500
      },
      "incidents": {
        "description": "One entry per incident of the task line. The runbook prose lives in the docs page named by `runbook.docs`; this entry holds the facts that can be verified.",
        "type": "array",
        "minItems": 1,
        "maxItems": 8,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "incident_id",
            "title",
            "meaning",
            "k_scenarios",
            "surfaces",
            "alerts",
            "signals",
            "detection_gaps",
            "mechanisms",
            "fault_cases",
            "local_tests",
            "runbook",
            "drill_id"
          ],
          "properties": {
            "incident_id": {
              "$ref": "#/$defs/IncidentId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 160
            },
            "meaning": {
              "description": "What counts as this incident.",
              "type": "string",
              "minLength": 20,
              "maxLength": 600
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
            "surfaces": {
              "type": "array",
              "minItems": 1,
              "maxItems": 6,
              "uniqueItems": true,
              "items": {
                "enum": [
                  "engine",
                  "gateway",
                  "provider",
                  "billing",
                  "storage",
                  "assistant",
                  "composition",
                  "platform"
                ]
              }
            },
            "alerts": {
              "description": "Alerts that carry the incident. A live alert is a rule of a PrometheusRule the base kustomization loads; a staged alert (`staged: true`) sits in a rule file no kustomization references yet.",
              "type": "array",
              "maxItems": 12,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "alert",
                  "role",
                  "staged"
                ],
                "properties": {
                  "alert": {
                    "$ref": "#/$defs/AlertName"
                  },
                  "role": {
                    "enum": [
                      "primary",
                      "supporting"
                    ]
                  },
                  "staged": {
                    "type": "boolean"
                  }
                }
              }
            },
            "signals": {
              "description": "Series shown on the dashboard for this incident (PromQL over series that exist).",
              "type": "array",
              "maxItems": 6,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "signal_id",
                  "title",
                  "panel",
                  "query",
                  "unit"
                ],
                "properties": {
                  "signal_id": {
                    "$ref": "common.schema.json#/$defs/ProfileId"
                  },
                  "title": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 120
                  },
                  "panel": {
                    "enum": [
                      "stat",
                      "timeseries"
                    ]
                  },
                  "query": {
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 600
                  },
                  "unit": {
                    "$ref": "common.schema.json#/$defs/Unit"
                  }
                }
              }
            },
            "detection_gaps": {
              "description": "What no alert or series covers today. An incident without an alert has at least one.",
              "type": "array",
              "maxItems": 4,
              "items": {
                "$ref": "#/$defs/Gap"
              }
            },
            "mechanisms": {
              "type": "array",
              "minItems": 1,
              "maxItems": 8,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "ref",
                  "file",
                  "contains"
                ],
                "properties": {
                  "ref": {
                    "description": "What this code does for the incident.",
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 300
                  },
                  "file": {
                    "$ref": "#/$defs/RepoPath"
                  },
                  "contains": {
                    "description": "A literal that must appear in the file (a symbol name or a constant): the check fails when the code moved.",
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 200
                  }
                }
              }
            },
            "fault_cases": {
              "description": "Cases of the P07-05 fault catalog that already carry the recovery behaviour (verified against the latest catalog).",
              "type": "array",
              "maxItems": 6,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/ProfileId"
              }
            },
            "local_tests": {
              "description": "Further deterministic tests that carry the incident (file and name are verified).",
              "type": "array",
              "maxItems": 12,
              "items": {
                "$ref": "#/$defs/TestRef"
              }
            },
            "runbook": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "docs",
                "never"
              ],
              "properties": {
                "docs": {
                  "description": "Runbook sections (a heading must exist in the page). The first one is the section of this pack's own runbook page.",
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 6,
                  "items": {
                    "$ref": "#/$defs/DocRef"
                  }
                },
                "never": {
                  "description": "Actions that make the incident worse; a drill records any of them as an unsafe action.",
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 6,
                  "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 240
                  }
                }
              }
            },
            "drill_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "alerts": {
                    "maxItems": 0
                  }
                },
                "required": [
                  "alerts"
                ]
              },
              "then": {
                "properties": {
                  "detection_gaps": {
                    "minItems": 1
                  }
                }
              }
            }
          ]
        }
      },
      "drills": {
        "description": "One scripted alarm drill per incident. The operator performs it on DEV with approval; the harness edits nothing.",
        "type": "array",
        "minItems": 1,
        "maxItems": 8,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "drill_id",
            "incident_id",
            "title",
            "operator_prerequisite",
            "injection",
            "detection",
            "condition_seconds",
            "signal_within_seconds",
            "recovery",
            "recovery_within_seconds",
            "never",
            "spends_credits"
          ],
          "properties": {
            "drill_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "incident_id": {
              "$ref": "#/$defs/IncidentId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "operator_prerequisite": {
              "type": "string",
              "minLength": 1,
              "maxLength": 600
            },
            "injection": {
              "type": "array",
              "minItems": 1,
              "maxItems": 8,
              "items": {
                "$ref": "#/$defs/Step"
              }
            },
            "detection": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "via",
                "alerts",
                "note"
              ],
              "properties": {
                "via": {
                  "description": "alert: a named alert fires; probe: no alert covers the incident yet and a consistency probe returns rows.",
                  "enum": [
                    "alert",
                    "probe"
                  ]
                },
                "alerts": {
                  "type": "array",
                  "maxItems": 4,
                  "items": {
                    "$ref": "#/$defs/AlertName"
                  }
                },
                "probe_id": {
                  "$ref": "common.schema.json#/$defs/ProfileId"
                },
                "note": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 400
                }
              },
              "allOf": [
                {
                  "if": {
                    "properties": {
                      "via": {
                        "const": "probe"
                      }
                    },
                    "required": [
                      "via"
                    ]
                  },
                  "then": {
                    "required": [
                      "probe_id"
                    ]
                  },
                  "else": {
                    "not": {
                      "required": [
                        "probe_id"
                      ]
                    }
                  }
                }
              ]
            },
            "condition_seconds": {
              "description": "How long the injected condition needs before the alarm may fire (an age threshold, a TTL plus grace). The alert's own `for` is read from the rule at check time.",
              "type": "integer",
              "minimum": 0,
              "maximum": 7200
            },
            "signal_within_seconds": {
              "description": "Frozen bound: the alarm (or probe row) is seen this long after the injection. It must cover condition + the alert's `for` + one evaluation margin.",
              "type": "integer",
              "minimum": 60,
              "maximum": 14400
            },
            "recovery": {
              "type": "array",
              "minItems": 1,
              "maxItems": 8,
              "items": {
                "$ref": "#/$defs/Step"
              }
            },
            "recovery_within_seconds": {
              "type": "integer",
              "minimum": 60,
              "maximum": 14400
            },
            "never": {
              "description": "The unsafe actions of the incident, restated for the drill: doing one is an unsafe action.",
              "type": "array",
              "minItems": 1,
              "maxItems": 6,
              "items": {
                "type": "string",
                "minLength": 1,
                "maxLength": 240
              }
            },
            "spends_credits": {
              "type": "boolean"
            },
            "reuses_fault_scenario": {
              "description": "A DEV scenario of the P07-05 catalog whose injection this drill reuses.",
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "requires_staged_rules": {
              "description": "The drill needs the staged rule file to be enabled by the operator first.",
              "type": "boolean"
            }
          }
        }
      },
      "dashboard": {
        "description": "Identity of the inert dashboard. The panels are rendered from the incidents' signals, the alerts of each incident and the soak series; the staged ConfigMap file is a drift-checked render of this pack.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "dashboard_id",
          "uid",
          "title",
          "tags",
          "staged_dashboard_file",
          "staged_rules_file",
          "recorded_alert_series"
        ],
        "properties": {
          "dashboard_id": {
            "$ref": "common.schema.json#/$defs/ProfileId"
          },
          "uid": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{2,39}$"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          },
          "tags": {
            "type": "array",
            "minItems": 1,
            "maxItems": 6,
            "items": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9-]{1,30}$"
            }
          },
          "staged_dashboard_file": {
            "$ref": "#/$defs/RepoPath"
          },
          "staged_rules_file": {
            "$ref": "#/$defs/RepoPath"
          },
          "recorded_alert_series": {
            "description": "Built-in Prometheus series the panels may use besides the exported ones (the alert state series).",
            "type": "array",
            "maxItems": 4,
            "items": {
              "type": "string",
              "pattern": "^[A-Za-z_][A-Za-z0-9_:]*$"
            }
          }
        }
      },
      "consistency": {
        "description": "Read-only consistency checks. Each `sql` is one SELECT that returns the offending keys and nothing else (ids, never content). The operator runs it against the restored (or live) DEV database; the count of rows is the result. The checks of the core database are executed on a real PostgreSQL by the gateway integration test.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "checks"
        ],
        "properties": {
          "checks": {
            "type": "array",
            "minItems": 1,
            "maxItems": 24,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "check_id",
                "scope",
                "database",
                "severity",
                "title",
                "invariant",
                "sql",
                "tables",
                "k_scenarios",
                "time_relative"
              ],
              "properties": {
                "check_id": {
                  "$ref": "common.schema.json#/$defs/ProfileId"
                },
                "scope": {
                  "enum": [
                    "project_ref",
                    "approval_wait"
                  ]
                },
                "database": {
                  "enum": [
                    "core",
                    "assistant"
                  ]
                },
                "severity": {
                  "description": "violation: a row is an inconsistency (a gate). advisory: a row is reported and decides nothing (a state that time or a running job resolves).",
                  "enum": [
                    "violation",
                    "advisory"
                  ]
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 200
                },
                "invariant": {
                  "type": "string",
                  "minLength": 20,
                  "maxLength": 500
                },
                "sql": {
                  "type": "string",
                  "minLength": 20,
                  "maxLength": 2400
                },
                "tables": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 6,
                  "uniqueItems": true,
                  "items": {
                    "$ref": "#/$defs/SqlTable"
                  }
                },
                "k_scenarios": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 6,
                  "uniqueItems": true,
                  "items": {
                    "$ref": "common.schema.json#/$defs/KScenario"
                  }
                },
                "time_relative": {
                  "description": "The result depends on now() (an age window).",
                  "type": "boolean"
                },
                "incident_ids": {
                  "type": "array",
                  "maxItems": 5,
                  "uniqueItems": true,
                  "items": {
                    "$ref": "#/$defs/IncidentId"
                  }
                }
              }
            }
          }
        }
      },
      "restore": {
        "description": "The backup/restore drill: dump, restore into a scratch database, run the consistency checks, compare row counts. Nothing is restored by the harness.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "drill_id",
          "title",
          "operator_prerequisite",
          "steps",
          "table_count_tables",
          "never",
          "docs",
          "gaps"
        ],
        "properties": {
          "drill_id": {
            "$ref": "common.schema.json#/$defs/ProfileId"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "operator_prerequisite": {
            "type": "string",
            "minLength": 1,
            "maxLength": 600
          },
          "steps": {
            "type": "array",
            "minItems": 1,
            "maxItems": 12,
            "items": {
              "$ref": "#/$defs/Step"
            }
          },
          "table_count_tables": {
            "description": "Tables whose row counts are compared between the source and the restored database while writers are quiesced.",
            "type": "array",
            "minItems": 1,
            "maxItems": 16,
            "uniqueItems": true,
            "items": {
              "$ref": "#/$defs/SqlTable"
            }
          },
          "never": {
            "type": "array",
            "minItems": 1,
            "maxItems": 6,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 240
            }
          },
          "docs": {
            "type": "array",
            "minItems": 1,
            "maxItems": 4,
            "items": {
              "$ref": "#/$defs/DocRef"
            }
          },
          "gaps": {
            "type": "array",
            "maxItems": 4,
            "items": {
              "$ref": "#/$defs/Gap"
            }
          }
        }
      },
      "soak": {
        "description": "The 24 h DEV soak profile (TK-38: no staging or canary exists before production readiness; the soak runs on DEV). A soak needs the operator, an approved cost cap and a frozen DEV deployment; `soak check` reads what was collected and derives the samples of the plan run.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "profile_id",
          "title",
          "minimum_window_seconds",
          "warmup_seconds",
          "sample_interval_seconds",
          "growth_fraction",
          "load",
          "preconditions",
          "invalidating_events",
          "series"
        ],
        "properties": {
          "profile_id": {
            "$ref": "common.schema.json#/$defs/ProfileId"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "minimum_window_seconds": {
            "description": "The steady window after warm-up: at least 24 h (FAZ-07 P07-08).",
            "type": "integer",
            "minimum": 86400,
            "maximum": 172800
          },
          "warmup_seconds": {
            "type": "integer",
            "minimum": 0,
            "maximum": 7200
          },
          "sample_interval_seconds": {
            "description": "Cadence of the PromQL series. A probe series states its own interval.",
            "type": "integer",
            "minimum": 15,
            "maximum": 3600
          },
          "growth_fraction": {
            "description": "growth_ratio compares the mean of the last and the first fraction of the steady window.",
            "type": "number",
            "minimum": 0.1,
            "maximum": 0.5
          },
          "load": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "scenario",
              "users",
              "note"
            ],
            "properties": {
              "scenario": {
                "$ref": "common.schema.json#/$defs/VersionedRef"
              },
              "users": {
                "type": "integer",
                "minimum": 1,
                "maximum": 50
              },
              "note": {
                "type": "string",
                "minLength": 1,
                "maxLength": 600
              }
            }
          },
          "preconditions": {
            "type": "array",
            "minItems": 1,
            "maxItems": 10,
            "items": {
              "$ref": "#/$defs/Step"
            }
          },
          "invalidating_events": {
            "description": "Events the operator records in the timeline; one inside the steady window voids the run (it is recorded as aborted and must be repeated).",
            "type": "array",
            "minItems": 1,
            "maxItems": 8,
            "uniqueItems": true,
            "items": {
              "enum": [
                "rollout",
                "node_drain",
                "operator_intervention",
                "load_change",
                "database_failover"
              ]
            }
          },
          "series": {
            "type": "array",
            "minItems": 1,
            "maxItems": 40,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "series_id",
                "metric_id",
                "title",
                "collect",
                "derive"
              ],
              "properties": {
                "series_id": {
                  "$ref": "common.schema.json#/$defs/DimensionId"
                },
                "metric_id": {
                  "$ref": "common.schema.json#/$defs/MetricId"
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 160
                },
                "collect": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "kind",
                    "interval_seconds"
                  ],
                  "properties": {
                    "kind": {
                      "enum": [
                        "promql",
                        "sql_probe"
                      ]
                    },
                    "query": {
                      "type": "string",
                      "minLength": 3,
                      "maxLength": 800
                    },
                    "check_ids": {
                      "type": "array",
                      "minItems": 1,
                      "maxItems": 16,
                      "uniqueItems": true,
                      "items": {
                        "$ref": "common.schema.json#/$defs/ProfileId"
                      }
                    },
                    "interval_seconds": {
                      "type": "integer",
                      "minimum": 15,
                      "maximum": 3600
                    }
                  },
                  "allOf": [
                    {
                      "if": {
                        "properties": {
                          "kind": {
                            "const": "promql"
                          }
                        },
                        "required": [
                          "kind"
                        ]
                      },
                      "then": {
                        "required": [
                          "query"
                        ],
                        "not": {
                          "required": [
                            "check_ids"
                          ]
                        }
                      },
                      "else": {
                        "required": [
                          "check_ids"
                        ],
                        "not": {
                          "required": [
                            "query"
                          ]
                        }
                      }
                    }
                  ]
                },
                "derive": {
                  "description": "window_values: every steady sample is a sample of the metric (one per sampling window). growth_ratio, counter_increase, max_value: one derived value.",
                  "enum": [
                    "window_values",
                    "growth_ratio",
                    "counter_increase",
                    "max_value"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "pack_revision": {
              "minimum": 2
            }
          },
          "required": [
            "pack_revision"
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
    ],
    "$defs": {
      "IncidentId": {
        "enum": [
          "queue_stuck",
          "provider_unknown_outcome",
          "approval_expiry",
          "orphan_artifact",
          "finance_pending"
        ]
      },
      "AlertName": {
        "type": "string",
        "pattern": "^[A-Z][A-Za-z0-9]{5,79}$"
      },
      "RepoPath": {
        "type": "string",
        "pattern": "^[A-Za-z0-9_./-]{3,200}$"
      },
      "SqlTable": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$"
      },
      "Step": {
        "type": "string",
        "minLength": 1,
        "maxLength": 500
      },
      "DocRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "path",
          "heading"
        ],
        "properties": {
          "path": {
            "type": "string",
            "pattern": "^docs/[A-Za-z0-9_./-]{3,200}$"
          },
          "heading": {
            "description": "The text of a markdown heading of the page (verified).",
            "type": "string",
            "minLength": 1,
            "maxLength": 160
          }
        }
      },
      "TestRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "runner",
          "file",
          "ref",
          "needs_infra"
        ],
        "properties": {
          "runner": {
            "enum": [
              "pytest",
              "vitest"
            ]
          },
          "file": {
            "$ref": "#/$defs/RepoPath"
          },
          "ref": {
            "description": "The exact test name.",
            "type": "string",
            "minLength": 1,
            "maxLength": 300
          },
          "needs_infra": {
            "description": "true: needs a real Postgres, Redis or Temporal (never run by the default local run; reported as not run).",
            "type": "boolean"
          },
          "note": {
            "type": "string",
            "maxLength": 300
          }
        }
      },
      "Gap": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "gap_id",
          "note"
        ],
        "properties": {
          "gap_id": {
            "$ref": "common.schema.json#/$defs/ProfileId"
          },
          "note": {
            "description": "What is not covered and who owns the follow-up.",
            "type": "string",
            "minLength": 20,
            "maxLength": 700
          },
          "verify": {
            "description": "A claim the check re-verifies against the repository: no file of the glob matches the pattern. When the claim stops being true the check fails and the next revision retires the gap.",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "glob",
              "pattern"
            ],
            "properties": {
              "kind": {
                "const": "absent_pattern"
              },
              "glob": {
                "type": "string",
                "pattern": "^[A-Za-z0-9_./*-]{3,200}$"
              },
              "pattern": {
                "type": "string",
                "minLength": 1,
                "maxLength": 200
              }
            }
          }
        }
      }
    }
  },
  "ops-record.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ops-evidence/v1/ops-record.schema.json",
    "title": "ops_record_v1",
    "description": "How one ops-evidence run group is recorded (FAZ-07; K150: a gate that was not measured is never done). A record pins the plan, the frozen thresholds revision and their hashes and the commit, keeps every raw sample (nothing is removed as an outlier), derives each result from those samples, states the coverage and the verdict. A record of kind evaluator_fixture only tests the evaluator and carries synthetic numbers: it is never a measurement and can never be read as one. Records of kind measurement are run artifacts (CI/DEV workflow artifacts): they are never committed into this package.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "record_id",
      "record_kind",
      "campaign",
      "recorded_at",
      "plan",
      "plan_sha256",
      "thresholds",
      "thresholds_sha256",
      "environment",
      "runs",
      "results",
      "coverage",
      "verdict"
    ],
    "properties": {
      "schema_version": {
        "const": "ops_record_v1"
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
      "campaign": {
        "$ref": "common.schema.json#/$defs/Campaign"
      },
      "recorded_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "plan": {
        "$ref": "common.schema.json#/$defs/VersionedRef"
      },
      "plan_sha256": {
        "description": "Canonical sha256 of the frozen plan revision (ops-rules.json freeze.registry).",
        "$ref": "common.schema.json#/$defs/Sha256"
      },
      "thresholds": {
        "$ref": "common.schema.json#/$defs/VersionedRef"
      },
      "thresholds_sha256": {
        "description": "Canonical sha256 of the frozen thresholds revision the results were evaluated against.",
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
          "operator_approval": {
            "description": "dev_cluster only: the reference of the operator's approval for the load (a request id or a chat reference); the harness refuses to execute without it.",
            "type": "string",
            "minLength": 3,
            "maxLength": 200
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
        "maxItems": 48,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "run_id",
            "repetitions_executed",
            "aborted"
          ],
          "properties": {
            "run_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "repetitions_executed": {
              "type": "integer",
              "minimum": 0,
              "maximum": 30
            },
            "aborted": {
              "type": "boolean"
            },
            "abort_reason": {
              "type": "string",
              "minLength": 1,
              "maxLength": 300
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "aborted": {
                    "const": true
                  }
                },
                "required": [
                  "aborted"
                ]
              },
              "then": {
                "required": [
                  "abort_reason"
                ]
              },
              "else": {
                "not": {
                  "required": [
                    "abort_reason"
                  ]
                }
              }
            }
          ]
        }
      },
      "results": {
        "type": "array",
        "minItems": 1,
        "maxItems": 800,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "run_id",
            "metric_id",
            "samples",
            "result"
          ],
          "properties": {
            "run_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "metric_id": {
              "$ref": "common.schema.json#/$defs/MetricId"
            },
            "samples": {
              "description": "Every raw sample in the order it was taken. A failed sample is recorded as a sample and as a failure of the run, never dropped.",
              "type": "array",
              "maxItems": 20000,
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
              }
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
            "environment": {
              "properties": {
                "kind": {
                  "const": "dev_cluster"
                }
              },
              "required": [
                "kind"
              ]
            }
          },
          "required": [
            "environment"
          ]
        },
        "then": {
          "properties": {
            "environment": {
              "required": [
                "operator_approval"
              ]
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
  "ops-run-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ops-evidence/v1/ops-run-plan.schema.json",
    "title": "ops_run_plan_v1",
    "description": "What one ops-evidence campaign runs (FAZ-07): the runs, each pinning a scenario, the sampling window, the metrics it records, the abort conditions and the cost cap. The plan pins the exact frozen thresholds revision it measures against. It defines the runs; it never contains a result. The harness executes a plan dry-run by default: nothing is sent anywhere unless an explicit --execute is given with an allowed non-production target and a recorded operator approval (never production, AGENTS.md).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "plan_id",
      "plan_revision",
      "campaign",
      "status",
      "frozen_at",
      "statement",
      "thresholds",
      "safety",
      "runs"
    ],
    "properties": {
      "schema_version": {
        "const": "ops_run_plan_v1"
      },
      "plan_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "plan_revision": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "campaign": {
        "$ref": "common.schema.json#/$defs/Campaign"
      },
      "status": {
        "const": "frozen"
      },
      "frozen_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "statement": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "thresholds": {
        "$ref": "common.schema.json#/$defs/VersionedRef"
      },
      "safety": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "dry_run_default",
          "production_allowed",
          "dev_requires_operator_approval"
        ],
        "properties": {
          "dry_run_default": {
            "const": true
          },
          "production_allowed": {
            "const": false
          },
          "dev_requires_operator_approval": {
            "const": true
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
            "title",
            "scenario",
            "environments",
            "steady_seconds",
            "sample_interval_seconds",
            "repetitions",
            "metrics",
            "abort_conditions"
          ],
          "properties": {
            "run_id": {
              "$ref": "common.schema.json#/$defs/ProfileId"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200
            },
            "scenario": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "id"
              ],
              "properties": {
                "kind": {
                  "enum": [
                    "capacity_scenario",
                    "autoscale_scenario",
                    "fault_scenario",
                    "cache_fixture",
                    "soak_profile",
                    "operations_scenario"
                  ]
                },
                "id": {
                  "$ref": "common.schema.json#/$defs/ProfileId"
                },
                "revision": {
                  "$ref": "common.schema.json#/$defs/Revision"
                }
              }
            },
            "environments": {
              "description": "Where this run may execute. A model or fixture run is local/ci; a load or soak run is dev_cluster and needs the operator.",
              "type": "array",
              "minItems": 1,
              "maxItems": 3,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/TargetEnvironment"
              }
            },
            "users": {
              "description": "capacity scenarios only: run this single user count instead of the scenario's whole ramp.",
              "type": "integer",
              "minimum": 1,
              "maximum": 1000
            },
            "steady_seconds": {
              "description": "Length of the measured window after warm-up; the samples of a percentile metric are taken inside it.",
              "type": "integer",
              "minimum": 1,
              "maximum": 172800
            },
            "sample_interval_seconds": {
              "type": "integer",
              "minimum": 1,
              "maximum": 3600
            },
            "repetitions": {
              "description": "Independent executions of the run; samples of a repetition are pooled.",
              "type": "integer",
              "minimum": 1,
              "maximum": 30
            },
            "metrics": {
              "type": "array",
              "minItems": 1,
              "maxItems": 60,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/MetricId"
              }
            },
            "abort_conditions": {
              "description": "The run stops itself and records the abort when one holds (a safety stop, never a way to drop a failed sample).",
              "type": "array",
              "maxItems": 8,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "metric_id",
                  "operator",
                  "value",
                  "reason"
                ],
                "properties": {
                  "metric_id": {
                    "$ref": "common.schema.json#/$defs/MetricId"
                  },
                  "operator": {
                    "$ref": "common.schema.json#/$defs/Operator"
                  },
                  "value": {
                    "type": "number",
                    "minimum": 0
                  },
                  "reason": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 300
                  }
                }
              }
            },
            "cost_cap_credits": {
              "description": "Upper bound of credits the run may spend on DEV (provider generation). Required for a dev_cluster run that submits generation work.",
              "type": "number",
              "minimum": 0
            },
            "note": {
              "type": "string",
              "maxLength": 600
            }
          }
        }
      }
    }
  },
  "ops-thresholds.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ops-evidence/v1/ops-thresholds.schema.json",
    "title": "ops_thresholds_v1",
    "description": "The metric catalogue and the frozen bounds of one ops-evidence campaign (FAZ-07: 'Threshold'lari once dondur'; K150: a gate that was not measured is never done). Every number is fixed before any measurement and is a candidate target, never a result. A revision is immutable: a change is a new revision that names the one it supersedes and why, and needs new full evidence; a bound is never relaxed after a result was seen (KARAR-FRAME-EXTRACT-VE-SANDBOX). A metric that is report-only carries no bound and never gates.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "thresholds_id",
      "thresholds_revision",
      "campaign",
      "status",
      "frozen_at",
      "statement",
      "metrics"
    ],
    "properties": {
      "schema_version": {
        "const": "ops_thresholds_v1"
      },
      "thresholds_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "thresholds_revision": {
        "$ref": "common.schema.json#/$defs/Revision"
      },
      "campaign": {
        "$ref": "common.schema.json#/$defs/Campaign"
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
            "title",
            "k_scenarios",
            "unit",
            "statistic",
            "gate",
            "source",
            "basis",
            "basis_note"
          ],
          "properties": {
            "metric_id": {
              "$ref": "common.schema.json#/$defs/MetricId"
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
              "description": "true: the bound decides pass/fail. false: the metric is only reported (an observation whose limit is another task's decision) and has no bound.",
              "type": "boolean"
            },
            "bound": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "operator",
                "value"
              ],
              "properties": {
                "operator": {
                  "$ref": "common.schema.json#/$defs/Operator"
                },
                "value": {
                  "type": "number",
                  "minimum": 0
                }
              }
            },
            "min_samples": {
              "description": "Overrides the protocol minimum of 30 samples. Allowed only for a statistic that is not a percentile (a violation count or an extreme needs one sample per run, a percentile never does).",
              "type": "integer",
              "minimum": 1,
              "maximum": 29
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
                  "description": "prometheus/platform_prometheus: the exported series name; harness: the probe the driver uses; model: the calculator output key.",
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 120
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
                      "required": [
                        "name"
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
                "required": [
                  "bound"
                ]
              },
              "else": {
                "not": {
                  "required": [
                    "bound"
                  ]
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

export const DOCUMENT_TYPES = ["autoscale-policy", "cache-pack", "capacity-model", "capacity-scenario", "fault-catalog", "operations-pack", "ops-record", "ops-run-plan", "ops-thresholds"] as const;
export type DocumentType = "autoscale-policy" | "cache-pack" | "capacity-model" | "capacity-scenario" | "fault-catalog" | "operations-pack" | "ops-record" | "ops-run-plan" | "ops-thresholds";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "autoscale-policy": [
    "ops_autoscale_policy_v1"
  ],
  "cache-pack": [
    "ops_cache_pack_v1"
  ],
  "capacity-model": [
    "ops_capacity_model_v1"
  ],
  "capacity-scenario": [
    "ops_capacity_scenario_v1"
  ],
  "fault-catalog": [
    "ops_fault_catalog_v1"
  ],
  "operations-pack": [
    "ops_operations_pack_v1"
  ],
  "ops-record": [
    "ops_record_v1"
  ],
  "ops-run-plan": [
    "ops_run_plan_v1"
  ],
  "ops-thresholds": [
    "ops_thresholds_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type AutoscalePolicy = {
    readonly "schema_version": "ops_autoscale_policy_v1";
    readonly "policy_id": string;
    readonly "policy_revision": number;
    readonly "status": "frozen";
    readonly "frozen_at": unknown;
    readonly "supersedes"?: {
    readonly "revision": number;
    readonly "reason": string;
  };
    readonly "statement": string;
    readonly "requirements": readonly ({
    readonly "requirement_id": string;
    readonly "clause": string;
    readonly "evidence": readonly ({
    readonly "kind": "static_check" | "test" | "dev_drill" | "gap";
    readonly "ref": string;
    readonly "file"?: string;
    readonly "note"?: string;
  })[];
  })[];
    readonly "baseline_findings": readonly ({
    readonly "profile_id": "dev_effective" | "base_declared";
    readonly "finding": "replicas_declared_under_autoscaler" | "schedule_to_start_uncovered" | "ephemeral_storage_undeclared";
    readonly "queues": readonly (string)[];
    readonly "note": string;
  })[];
    readonly "scale_cap": {
    readonly "profile_id": "dev_effective" | "base_declared";
    readonly "ratchet": {
    readonly "pods": number;
    readonly "cpu_request_cores": number;
    readonly "cpu_limit_cores": number;
    readonly "memory_request_gib": number;
    readonly "memory_limit_gib": number;
    readonly "ephemeral_storage_limit_gib": number;
  };
    readonly "basis": "exact_requirement" | "plan_candidate" | "agent_proposed_candidate";
    readonly "basis_note": string;
    readonly "cost_inputs": readonly (string)[];
  };
    readonly "provider_lane_groups": Record<string, unknown>;
    readonly "drills": readonly ({
    readonly "drill_id": string;
    readonly "title": string;
    readonly "requirements": readonly (string)[];
    readonly "operator_prerequisite": string;
    readonly "steps": readonly (string)[];
    readonly "expected": string;
  })[];
  };
export type CachePack = {
    readonly "schema_version": "ops_cache_pack_v1";
    readonly "pack_id": string;
    readonly "pack_revision": number;
    readonly "status": "frozen";
    readonly "frozen_at": unknown;
    readonly "supersedes"?: {
    readonly "revision": number;
    readonly "reason": string;
  };
    readonly "statement": string;
    readonly "class_policies": readonly ({
    readonly "class_id": "mutable_metadata" | "immutable_body" | "session_projection" | "authoritative_negative";
    readonly "ttl_ms": number;
    readonly "jitter_ratio": number;
    readonly "max_ttl_ms": number;
    readonly "max_entry_bytes": number;
  })[];
    readonly "engine_defaults": {
    readonly "store_op_timeout_ms": number;
    readonly "lease_ttl_ms": number;
    readonly "lease_wait_ms": number;
    readonly "lease_poll_ms": number;
    readonly "bindings": unknown;
  };
    readonly "surface_configs": readonly ({
    readonly "config_id": string;
    readonly "source_max_concurrent": number;
    readonly "source_max_wait_ms": number;
    readonly "breaker_failures": number;
    readonly "breaker_open_ms": number;
    readonly "partition_max_bytes": number;
    readonly "partition_window_ms": number;
    readonly "loader_timeout_ms"?: number;
    readonly "bindings": unknown;
  })[];
    readonly "stream": {
    readonly "page_size": number;
    readonly "max_pages_per_drain": number;
    readonly "repair_intervals_ms": readonly (number)[];
    readonly "jitter_ratio": number;
    readonly "resync_jitter_ms": number;
    readonly "fallback_retry_ms": number;
    readonly "bindings": unknown;
  };
    readonly "parameters": {
    readonly "warm_reads": number;
    readonly "cold_same_key_concurrency": number;
    readonly "fleet_processes": number;
    readonly "fleet_same_key_concurrency": number;
    readonly "distinct_cold_keys": number;
    readonly "outage_reads_after_open": number;
    readonly "page_sizes": readonly (number)[];
    readonly "loader_delay_ms": number;
  };
    readonly "surfaces": readonly ({
    readonly "surface_id": string;
    readonly "title": string;
    readonly "config_id": string;
    readonly "driver": "adapter" | "engine";
    readonly "adapter"?: string;
    readonly "namespaces": readonly ({
    readonly "namespace": string;
    readonly "file": string;
  })[];
  })[];
    readonly "fixtures": readonly ({
    readonly "fixture_id": string;
    readonly "title": string;
    readonly "k_scenarios": readonly (string)[];
    readonly "surfaces": readonly (string)[];
    readonly "measures": readonly (string)[];
    readonly "evidence": unknown;
  })[];
    readonly "local_metrics": readonly (string)[];
    readonly "known_findings": readonly ({
    readonly "finding_id": string;
    readonly "surface": string;
    readonly "metric_id": string;
    readonly "measured": number;
    readonly "note": string;
  })[];
    readonly "dev_scenarios": readonly ({
    readonly "scenario_id": string;
    readonly "title": string;
    readonly "fixtures": readonly (string)[];
    readonly "operator_prerequisite": string;
    readonly "steps": readonly (string)[];
    readonly "expected": string;
    readonly "never": string;
  })[];
  };
export type CapacityModel = {
    readonly "schema_version": "ops_capacity_model_v1";
    readonly "model_id": string;
    readonly "model_revision": number;
    readonly "status": "frozen";
    readonly "frozen_at": unknown;
    readonly "supersedes"?: {
    readonly "revision": number;
    readonly "reason": string;
  };
    readonly "statement": string;
    readonly "utilisation": {
    readonly "target": number;
    readonly "limit": 1;
    readonly "basis": "exact_requirement" | "plan_candidate" | "agent_proposed_candidate";
    readonly "basis_note": string;
  };
    readonly "scale_reaction": {
    readonly "hpa_sync_seconds": unknown;
    readonly "pod_ready_seconds": unknown;
    readonly "note": string;
  };
    readonly "capacity_profiles": readonly ({
    readonly "profile_id": "dev_effective" | "base_declared";
    readonly "source": string;
    readonly "description": string;
  })[];
    readonly "dimensions": readonly ({
    readonly "dimension_id": string;
    readonly "title": string;
    readonly "unit": "ms" | "s" | "bytes" | "mib" | "mbps" | "count" | "ratio" | "percent" | "queries_per_request" | "slots" | "cores" | "per_second" | "per_minute" | "credits";
    readonly "scope": "tenant" | "fleet";
    readonly "demand_kind": "occupancy" | "rate_per_second" | "rate_per_minute";
    readonly "keyed_by"?: "provider_group" | "queue";
    readonly "ceiling": {
    readonly "kind": "plan_default" | "code_constant" | "code_constant_times_snapshot" | "lane_slots" | "lane_cpu_limit_sum" | "operator_snapshot" | "none_declared";
    readonly "plan_key"?: string;
    readonly "file"?: string;
    readonly "pattern"?: string;
    readonly "value"?: number;
    readonly "snapshot_key"?: string;
    readonly "queues"?: readonly (string)[];
    readonly "gap"?: string;
  };
    readonly "observe": readonly ({
    readonly "kind": "prometheus" | "platform_prometheus" | "harness";
    readonly "name": string;
    readonly "note"?: string;
  })[];
  })[];
    readonly "job_classes": readonly ({
    readonly "class_id": string;
    readonly "title": string;
    readonly "node_type"?: string;
    readonly "node_inputs"?: Record<string, unknown>;
    readonly "impl_revision"?: number;
    readonly "funding_channel"?: "app" | "api" | "mcp";
    readonly "interactive"?: boolean;
    readonly "capacity_class"?: "general" | "short" | "export" | "none";
    readonly "queue"?: string;
    readonly "provider_group"?: "llm" | "stt" | "tts" | "image" | "video";
    readonly "durations": {
    readonly "run"?: unknown;
    readonly "permit"?: unknown;
    readonly "node"?: unknown;
    readonly "provider"?: unknown;
    readonly "cpu"?: unknown;
  };
    readonly "footprints": readonly ({
    readonly "dimension_id": string;
    readonly "key"?: string;
    readonly "units": number;
    readonly "hold": "run" | "permit" | "node" | "provider" | "cpu" | "per_job";
  })[];
  })[];
  };
export type CapacityScenario = {
    readonly "schema_version": "ops_capacity_scenario_v1";
    readonly "scenario_id": string;
    readonly "scenario_revision": number;
    readonly "title": string;
    readonly "description"?: string;
    readonly "model": unknown;
    readonly "k_scenarios": readonly (string)[];
    readonly "tenant_groups": readonly ({
    readonly "group_id": string;
    readonly "plan": "basic" | "starter" | "pro" | "max" | "enterprise";
    readonly "weight": number;
    readonly "users_per_tenant": number;
  })[];
    readonly "ramp_users": readonly (number)[];
    readonly "active_fraction": {
    readonly "value": number;
    readonly "basis": "assumed_unmeasured" | "coordinator_dev_sample" | "repo_config" | "operator_snapshot";
    readonly "note"?: string;
  };
    readonly "workload": readonly ({
    readonly "class_id": string;
    readonly "per_active_user_per_hour": number;
    readonly "burst_per_tenant"?: number;
    readonly "basis": "assumed_unmeasured" | "coordinator_dev_sample" | "repo_config" | "operator_snapshot";
  })[];
    readonly "capacity_profiles": readonly ("dev_effective" | "base_declared")[];
    readonly "expected_backpressure": readonly ({
    readonly "profile_id": "dev_effective" | "base_declared";
    readonly "dimension_id": string;
    readonly "key"?: string;
    readonly "queue_reason"?: string;
  })[];
  };
export type FaultCatalog = {
    readonly "schema_version": "ops_fault_catalog_v1";
    readonly "catalog_id": string;
    readonly "catalog_revision": number;
    readonly "status": "frozen";
    readonly "frozen_at": unknown;
    readonly "supersedes"?: {
    readonly "revision": number;
    readonly "reason": string;
  };
    readonly "statement": string;
    readonly "groups": readonly ({
    readonly "group_id": string;
    readonly "title": string;
    readonly "clause": string;
  })[];
    readonly "cases": readonly ({
    readonly "case_id": string;
    readonly "group_id": string;
    readonly "surface": "engine" | "gateway" | "provider" | "billing" | "storage" | "assistant" | "memory" | "connector" | "skill" | "platform";
    readonly "title": string;
    readonly "fault": string;
    readonly "boundary": string;
    readonly "requires_local": boolean;
    readonly "k_scenarios": readonly (string)[];
    readonly "invariants": readonly ({
    readonly "invariant_id": string;
    readonly "statement": string;
  })[];
    readonly "evidence": readonly ({
    readonly "kind": "local_test" | "dev_scenario" | "gap";
    readonly "ref": string;
    readonly "runner"?: "pytest" | "vitest";
    readonly "file"?: string;
    readonly "needs_infra"?: boolean;
    readonly "note"?: string;
  })[];
  })[];
    readonly "dev_scenarios": readonly ({
    readonly "scenario_id": string;
    readonly "title": string;
    readonly "cases": readonly (string)[];
    readonly "operator_prerequisite": string;
    readonly "steps": readonly (string)[];
    readonly "expected": string;
    readonly "never": string;
  })[];
  };
export type OperationsPack = {
    readonly "schema_version": "ops_operations_pack_v1";
    readonly "pack_id": string;
    readonly "pack_revision": number;
    readonly "status": "frozen";
    readonly "frozen_at": unknown;
    readonly "supersedes"?: {
    readonly "revision": number;
    readonly "reason": string;
  };
    readonly "statement": string;
    readonly "incidents": readonly ({
    readonly "incident_id": "queue_stuck" | "provider_unknown_outcome" | "approval_expiry" | "orphan_artifact" | "finance_pending";
    readonly "title": string;
    readonly "meaning": string;
    readonly "k_scenarios": readonly (string)[];
    readonly "surfaces": readonly ("engine" | "gateway" | "provider" | "billing" | "storage" | "assistant" | "composition" | "platform")[];
    readonly "alerts": readonly ({
    readonly "alert": string;
    readonly "role": "primary" | "supporting";
    readonly "staged": boolean;
  })[];
    readonly "signals": readonly ({
    readonly "signal_id": string;
    readonly "title": string;
    readonly "panel": "stat" | "timeseries";
    readonly "query": string;
    readonly "unit": "ms" | "s" | "bytes" | "mib" | "mbps" | "count" | "ratio" | "percent" | "queries_per_request" | "slots" | "cores" | "per_second" | "per_minute" | "credits";
  })[];
    readonly "detection_gaps": readonly (unknown)[];
    readonly "mechanisms": readonly ({
    readonly "ref": string;
    readonly "file": string;
    readonly "contains": string;
  })[];
    readonly "fault_cases": readonly (string)[];
    readonly "local_tests": readonly (unknown)[];
    readonly "runbook": {
    readonly "docs": readonly (unknown)[];
    readonly "never": readonly (string)[];
  };
    readonly "drill_id": string;
  })[];
    readonly "drills": readonly ({
    readonly "drill_id": string;
    readonly "incident_id": "queue_stuck" | "provider_unknown_outcome" | "approval_expiry" | "orphan_artifact" | "finance_pending";
    readonly "title": string;
    readonly "operator_prerequisite": string;
    readonly "injection": readonly (string)[];
    readonly "detection": {
    readonly "via": "alert" | "probe";
    readonly "alerts": readonly (string)[];
    readonly "probe_id"?: string;
    readonly "note": string;
  };
    readonly "condition_seconds": number;
    readonly "signal_within_seconds": number;
    readonly "recovery": readonly (string)[];
    readonly "recovery_within_seconds": number;
    readonly "never": readonly (string)[];
    readonly "spends_credits": boolean;
    readonly "reuses_fault_scenario"?: string;
    readonly "requires_staged_rules"?: boolean;
  })[];
    readonly "dashboard": {
    readonly "dashboard_id": string;
    readonly "uid": string;
    readonly "title": string;
    readonly "tags": readonly (string)[];
    readonly "staged_dashboard_file": string;
    readonly "staged_rules_file": string;
    readonly "recorded_alert_series": readonly (string)[];
  };
    readonly "consistency": {
    readonly "checks": readonly ({
    readonly "check_id": string;
    readonly "scope": "project_ref" | "approval_wait";
    readonly "database": "core" | "assistant";
    readonly "severity": "violation" | "advisory";
    readonly "title": string;
    readonly "invariant": string;
    readonly "sql": string;
    readonly "tables": readonly (string)[];
    readonly "k_scenarios": readonly (string)[];
    readonly "time_relative": boolean;
    readonly "incident_ids"?: readonly ("queue_stuck" | "provider_unknown_outcome" | "approval_expiry" | "orphan_artifact" | "finance_pending")[];
  })[];
  };
    readonly "restore": {
    readonly "drill_id": string;
    readonly "title": string;
    readonly "operator_prerequisite": string;
    readonly "steps": readonly (string)[];
    readonly "table_count_tables": readonly (string)[];
    readonly "never": readonly (string)[];
    readonly "docs": readonly (unknown)[];
    readonly "gaps": readonly (unknown)[];
  };
    readonly "soak": {
    readonly "profile_id": string;
    readonly "title": string;
    readonly "minimum_window_seconds": number;
    readonly "warmup_seconds": number;
    readonly "sample_interval_seconds": number;
    readonly "growth_fraction": number;
    readonly "load": {
    readonly "scenario": unknown;
    readonly "users": number;
    readonly "note": string;
  };
    readonly "preconditions": readonly (string)[];
    readonly "invalidating_events": readonly ("rollout" | "node_drain" | "operator_intervention" | "load_change" | "database_failover")[];
    readonly "series": readonly ({
    readonly "series_id": string;
    readonly "metric_id": string;
    readonly "title": string;
    readonly "collect": {
    readonly "kind": "promql" | "sql_probe";
    readonly "query"?: string;
    readonly "check_ids"?: readonly (string)[];
    readonly "interval_seconds": number;
  };
    readonly "derive": "window_values" | "growth_ratio" | "counter_increase" | "max_value";
  })[];
  };
  };
export type OpsRecord = {
    readonly "schema_version": "ops_record_v1";
    readonly "record_id": string;
    readonly "record_kind": "measurement" | "evaluator_fixture";
    readonly "campaign": "capacity" | "queue_autoscale" | "fault_injection" | "cache_fault" | "operations_soak";
    readonly "recorded_at": unknown;
    readonly "plan": unknown;
    readonly "plan_sha256": unknown;
    readonly "thresholds": unknown;
    readonly "thresholds_sha256": unknown;
    readonly "environment": {
    readonly "kind": "dev_cluster" | "local" | "ci" | "fixture";
    readonly "commit_sha": string;
    readonly "operator_approval"?: string;
    readonly "note"?: string;
  };
    readonly "runs": readonly ({
    readonly "run_id": string;
    readonly "repetitions_executed": number;
    readonly "aborted": boolean;
    readonly "abort_reason"?: string;
  })[];
    readonly "results": readonly ({
    readonly "run_id": string;
    readonly "metric_id": string;
    readonly "samples": readonly (number)[];
    readonly "result": "pass" | "fail" | "insufficient_samples" | "not_measured" | "reported";
    readonly "statistic_value"?: number;
  })[];
    readonly "coverage": {
    readonly "gate_metrics_total": number;
    readonly "gate_metrics_recorded": number;
    readonly "missing_gate_metrics": readonly (string)[];
  };
    readonly "verdict": "pass" | "fail" | "incomplete";
  };
export type OpsRunPlan = {
    readonly "schema_version": "ops_run_plan_v1";
    readonly "plan_id": string;
    readonly "plan_revision": number;
    readonly "campaign": "capacity" | "queue_autoscale" | "fault_injection" | "cache_fault" | "operations_soak";
    readonly "status": "frozen";
    readonly "frozen_at": unknown;
    readonly "statement": string;
    readonly "thresholds": unknown;
    readonly "safety": {
    readonly "dry_run_default": true;
    readonly "production_allowed": false;
    readonly "dev_requires_operator_approval": true;
  };
    readonly "runs": readonly ({
    readonly "run_id": string;
    readonly "title": string;
    readonly "scenario": {
    readonly "kind": "capacity_scenario" | "autoscale_scenario" | "fault_scenario" | "cache_fixture" | "soak_profile" | "operations_scenario";
    readonly "id": string;
    readonly "revision"?: number;
  };
    readonly "environments": readonly ("local" | "ci" | "dev_cluster")[];
    readonly "users"?: number;
    readonly "steady_seconds": number;
    readonly "sample_interval_seconds": number;
    readonly "repetitions": number;
    readonly "metrics": readonly (string)[];
    readonly "abort_conditions": readonly ({
    readonly "metric_id": string;
    readonly "operator": "<=" | ">=" | "==";
    readonly "value": number;
    readonly "reason": string;
  })[];
    readonly "cost_cap_credits"?: number;
    readonly "note"?: string;
  })[];
  };
export type OpsThresholds = {
    readonly "schema_version": "ops_thresholds_v1";
    readonly "thresholds_id": string;
    readonly "thresholds_revision": number;
    readonly "campaign": "capacity" | "queue_autoscale" | "fault_injection" | "cache_fault" | "operations_soak";
    readonly "status": "frozen";
    readonly "frozen_at": unknown;
    readonly "supersedes"?: {
    readonly "revision": number;
    readonly "reason": string;
  };
    readonly "statement": string;
    readonly "metrics": readonly ({
    readonly "metric_id": string;
    readonly "title": string;
    readonly "k_scenarios": readonly (string)[];
    readonly "unit": "ms" | "s" | "bytes" | "mib" | "mbps" | "count" | "ratio" | "percent" | "queries_per_request" | "slots" | "cores" | "per_second" | "per_minute" | "credits";
    readonly "statistic": "p50" | "p95" | "p99" | "max" | "min" | "mean" | "sum" | "last";
    readonly "gate": boolean;
    readonly "bound"?: {
    readonly "operator": "<=" | ">=" | "==";
    readonly "value": number;
  };
    readonly "min_samples"?: number;
    readonly "source": {
    readonly "kind": "prometheus" | "platform_prometheus" | "harness" | "model" | "not_instrumented";
    readonly "name"?: string;
    readonly "gap"?: string;
  };
    readonly "basis": "exact_requirement" | "plan_candidate" | "agent_proposed_candidate";
    readonly "basis_note": string;
  })[];
  };

export const reader = new ContractPackageReader({
  package: "ops-evidence",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
