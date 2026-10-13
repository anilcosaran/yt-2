// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/long-run/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/long-run/v1/common.schema.json",
    "title": "long_run_common_v1",
    "description": "Shared definitions of the long-run v1 package (P05-08 long-run checkpoint). Not a standalone document type. Ids, hashes and timestamps are owned by assistant-runtime v1; allocation/receipt/artifact/pin/lineage shapes by production-execution v1 (Billing stays the only spend authority; Composition keeps refs only).",
    "$defs": {
      "Stage": {
        "description": "The durable stage of one plan ProductionRun operation, derived only from Composition's own rows (operation state, apply outcome, pinned result object). queued: bound, no external effect exists. in_flight: handed to Workflow; a provider effect may exist. outcome_unknown: the provider outcome is not known (allocation stays outstanding). take_stored: the take is durable in Storage (checksum pinned) but not applied to the project. take_applied: the take is placed in the project (asset or scene layer). take_attention: the take is durable but its apply ended as conflict/orphaned/superseded/detached/invalidated. failed_no_take: failed, canceled or abandoned without an artifact.",
        "enum": [
          "queued",
          "in_flight",
          "outcome_unknown",
          "take_stored",
          "take_applied",
          "take_attention",
          "failed_no_take"
        ]
      },
      "RestartAction": {
        "description": "What a restart, recovery or replan may do with the operation. None of them opens a second paid allocation or a second provider submit for an existing operation. replan_required replaces the mapped action of a not yet accepted operation whose pinned implementation can no longer run (never a silent move to the current stable).",
        "enum": [
          "start",
          "resume_same_workflow",
          "reconcile_only",
          "apply_take",
          "keep_take",
          "keep_take_attention",
          "user_retry_only",
          "replan_required"
        ]
      },
      "RunState": {
        "description": "composition_production_runs.state (P03-06); the checkpoint never derives a better state than its own counts allow.",
        "enum": [
          "planned",
          "running",
          "partial",
          "succeeded",
          "failed",
          "canceled"
        ]
      },
      "StageCounts": {
        "description": "Bounded per-stage counts of the run's operations (no per-operation payload).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "queued",
          "in_flight",
          "outcome_unknown",
          "take_stored",
          "take_applied",
          "take_attention",
          "failed_no_take"
        ],
        "properties": {
          "queued": {
            "type": "integer",
            "minimum": 0,
            "maximum": 256
          },
          "in_flight": {
            "type": "integer",
            "minimum": 0,
            "maximum": 256
          },
          "outcome_unknown": {
            "type": "integer",
            "minimum": 0,
            "maximum": 256
          },
          "take_stored": {
            "type": "integer",
            "minimum": 0,
            "maximum": 256
          },
          "take_applied": {
            "type": "integer",
            "minimum": 0,
            "maximum": 256
          },
          "take_attention": {
            "type": "integer",
            "minimum": 0,
            "maximum": 256
          },
          "failed_no_take": {
            "type": "integer",
            "minimum": 0,
            "maximum": 256
          }
        }
      },
      "OperationId": {
        "description": "P00-03 logical operation id of the Workflow node (wfnode_<40 hex>), the same id Billing records on the allocation.",
        "type": "string",
        "pattern": "^wfnode_[0-9a-f]{40}$"
      },
      "PageCursor": {
        "description": "Opaque keyset cursor (base64url) bound to the run; the next page starts after the last operation of this one. It is never a wall-clock cutoff and does not pin a snapshot: every page shows the current state of its own rows.",
        "type": "string",
        "pattern": "^[A-Za-z0-9_-]{8,256}$"
      },
      "ContinuationTrigger": {
        "description": "history_threshold: the run's own event count reached the continuation threshold. server_suggested: Temporal suggested Continue-As-New. Neither ever fires while a node executes: only at a quiescent boundary.",
        "enum": [
          "history_threshold",
          "server_suggested"
        ]
      },
      "TemporalRunId": {
        "description": "Opaque Temporal run id of the run that continued.",
        "type": "string",
        "minLength": 1,
        "maxLength": 128,
        "pattern": "^[^\\s]+$"
      },
      "CheckpointId": {
        "description": "Durable resume checkpoint id (workflow_resume_checkpoints.id, a UUID).",
        "type": "string",
        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
      }
    }
  },
  "long-run-checkpoint.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/long-run/v1/long-run-checkpoint.schema.json",
    "title": "long_run_checkpoint_v1",
    "description": "The bounded, derived checkpoint of one plan ProductionRun (P05-08): how many operations are in which durable stage, which logical executions (P00-09 pins) they belong to, and a digest of the ordered stage tuples. It is computed from Composition's own operation and completion rows on every read; it is not a second store and never rewrites history. It carries counts and refs only: the per-operation rows are read in pages (long_run_result_page_v1), so an event or tool payload stays bounded whatever the run size. A run is never `succeeded` while an operation is not an applied take.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "production_run_id",
      "business_job_id",
      "envelope_id",
      "run_state",
      "operation_count",
      "stage_counts",
      "executions",
      "stage_digest_sha256",
      "recorded_at"
    ],
    "properties": {
      "schema_version": {
        "const": "long_run_checkpoint_v1"
      },
      "production_run_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "business_job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "envelope_id": {
        "description": "The job's envelope (Assistant job and ProductionRun share it). Amounts are read from Billing; the checkpoint never holds a credit number.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/EnvelopeId"
      },
      "run_state": {
        "$ref": "common.schema.json#/$defs/RunState"
      },
      "operation_count": {
        "type": "integer",
        "minimum": 0,
        "maximum": 256
      },
      "stage_counts": {
        "$ref": "common.schema.json#/$defs/StageCounts"
      },
      "executions": {
        "description": "The distinct logical executions (P00-09 pins) of the run's operations. A replan adds a new logical execution; an operation never changes its own.",
        "type": "array",
        "maxItems": 16,
        "uniqueItems": true,
        "items": {
          "$ref": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/common.schema.json#/$defs/ExecutionPinRef"
        }
      },
      "stage_digest_sha256": {
        "description": "sha256 of the canonical, ordered (operation_id, stage, attempt, allocation_id, artifact checksum) tuples. Equal digests mean nothing moved; it is the change witness of a poll, not a cursor.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "recorded_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "long-run-continuation.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/long-run/v1/long-run-continuation.schema.json",
    "title": "long_run_continuation_v1",
    "description": "Witness of one Temporal Continue-As-New of a long Workflow run (P05-08). The workflow id stays, so the original start and execution deadline, the launch idempotency, the shared Billing binding (parent reservation, estimate, node cost estimates) and the pins (node_impl_pins and the execution DSL) are the SAME on every run of the chain; only the resume checkpoint, the run id and the history counters change. Accepted nodes are re-read from their durable node-result checkpoints, never carried inline and never re-executed. The Assistant conversation history, prompt text and inline node outputs are never carried: the run keeps ids and hashes only, so no history grows without bound and no run is moved to a different implementation silently. Hashes are sha256 of the canonical JSON (sorted keys, no whitespace, no ASCII escaping), bare lowercase hex.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "workflow_id",
      "continuation_index",
      "source_run_id",
      "trigger",
      "history_events",
      "original",
      "billing",
      "pins",
      "accepted",
      "carried",
      "exclusions",
      "recorded_at"
    ],
    "properties": {
      "schema_version": {
        "const": "long_run_continuation_v1"
      },
      "workflow_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "continuation_index": {
        "description": "1 for the first Continue-As-New of the workflow, then consecutive.",
        "type": "integer",
        "minimum": 1,
        "maximum": 1000
      },
      "source_run_id": {
        "$ref": "common.schema.json#/$defs/TemporalRunId"
      },
      "trigger": {
        "$ref": "common.schema.json#/$defs/ContinuationTrigger"
      },
      "history_events": {
        "description": "The source run's history length when it continued.",
        "type": "integer",
        "minimum": 0,
        "maximum": 1000000
      },
      "original": {
        "description": "The origin of the whole chain, identical on every continuation: the first run's start, the absolute execution deadline derived from it (never reset by a continuation) and the launch idempotency key by hash.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "started_at",
          "execution_deadline_at",
          "launch_idempotency_key_sha256"
        ],
        "properties": {
          "started_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "execution_deadline_at": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
          },
          "launch_idempotency_key_sha256": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
              }
            ]
          }
        }
      },
      "billing": {
        "description": "The shared Billing binding of the run, identical on every continuation. Allocation and receipt ids are derived from the workflow id and the node key, so an identical workflow id and node set keeps every allocation, receipt and settlement of the run. No credit amount is carried.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "workflow_reservation_id",
          "estimate_id",
          "node_cost_estimates_sha256"
        ],
        "properties": {
          "workflow_reservation_id": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              }
            ]
          },
          "estimate_id": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              }
            ]
          },
          "node_cost_estimates_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "pins": {
        "description": "The approved implementation pins of the run (P00-09), identical on every continuation: never re-resolved against the current stable/canary channel.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "node_impl_pins_sha256",
          "execution_dsl_sha256"
        ],
        "properties": {
          "node_impl_pins_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "execution_dsl_sha256": {
            "description": "sha256 of the executed DSL computed by the engine: the canonical-JSON twin of the Gateway `stableJsonHash` behind `execution_dsl_hash`. The two agree for documents whose numbers have one JSON spelling (an integral float such as 8.0 is spelled 8.0 by Python and 8 by JavaScript); a chain only ever compares engine-computed values with each other.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "accepted": {
        "description": "The nodes whose accepted result is durable in a node-result checkpoint. The count only grows along a chain; the results themselves stay in the checkpoint store.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "checkpointed_node_count",
          "checkpointed_nodes_sha256"
        ],
        "properties": {
          "checkpointed_node_count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100000
          },
          "checkpointed_nodes_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "carried": {
        "description": "What actually travels to the next run: the durable resume checkpoint id and the byte sizes of the carried Workflow input (a Temporal payload; bounded far below the 2 MiB blob limit) and of the resume state (stored in the database, not in Temporal).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "resume_checkpoint_id",
          "input_bytes",
          "state_bytes"
        ],
        "properties": {
          "resume_checkpoint_id": {
            "$ref": "common.schema.json#/$defs/CheckpointId"
          },
          "input_bytes": {
            "type": "integer",
            "minimum": 1,
            "maximum": 4194304
          },
          "state_bytes": {
            "type": "integer",
            "minimum": 1,
            "maximum": 67108864
          }
        }
      },
      "exclusions": {
        "description": "Explicit witnesses of what never travels. The Assistant history stays in the Assistant's own store (the run carries the run/conversation ids only); prompts stay out of Temporal; node outputs are re-read from their checkpoints.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "assistant_history",
          "prompt_text",
          "node_outputs_inline"
        ],
        "properties": {
          "assistant_history": {
            "const": "not_carried"
          },
          "prompt_text": {
            "const": "not_carried"
          },
          "node_outputs_inline": {
            "const": "not_carried"
          }
        }
      },
      "recorded_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      }
    }
  },
  "long-run-result-page.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/long-run/v1/long-run-result-page.schema.json",
    "title": "long_run_result_page_v1",
    "description": "One bounded page of a plan ProductionRun's operations (P05-08 paged result retrieval). Rows come from Composition's own operation/completion rows in a fixed creation order; a keyset cursor continues after the last row, so a page is never invalidated by a live run and no page is ever cut by bytes silently (the item count is bounded; at least one row is always returned). Every row names its durable stage and the only action a restart may take: no action opens a second paid allocation or a second provider submit for an existing operation. Refs only: no prompt text, URL, provider handle or credit amount.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "production_run_id",
      "checkpoint_digest_sha256",
      "operation_count",
      "range",
      "items",
      "next_cursor"
    ],
    "properties": {
      "schema_version": {
        "const": "long_run_result_page_v1"
      },
      "production_run_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "checkpoint_digest_sha256": {
        "description": "The stage digest of the checkpoint this page was cut from (long_run_checkpoint_v1.stage_digest_sha256). A different digest on the next page means the run moved between two pages; the rows of each page are still current.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "operation_count": {
        "type": "integer",
        "minimum": 0,
        "maximum": 256
      },
      "range": {
        "description": "Zero-based positions of this page in the run's ordered operation list: start inclusive, end exclusive.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "start",
          "end"
        ],
        "properties": {
          "start": {
            "type": "integer",
            "minimum": 0,
            "maximum": 256
          },
          "end": {
            "type": "integer",
            "minimum": 0,
            "maximum": 256
          }
        }
      },
      "items": {
        "type": "array",
        "maxItems": 50,
        "items": {
          "$ref": "#/$defs/Item"
        }
      },
      "next_cursor": {
        "description": "null when this page ends the list; otherwise the cursor of the next page.",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "common.schema.json#/$defs/PageCursor"
          }
        ]
      }
    },
    "$defs": {
      "Item": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "operation_id",
          "logical_kind",
          "stage",
          "restart_action",
          "attempt",
          "allocation_id",
          "receipt_id",
          "workflow",
          "artifact",
          "execution_pin",
          "lineage"
        ],
        "properties": {
          "operation_id": {
            "$ref": "common.schema.json#/$defs/OperationId"
          },
          "logical_kind": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/common.schema.json#/$defs/ProductionLogicalOperationKind"
          },
          "stage": {
            "$ref": "common.schema.json#/$defs/Stage"
          },
          "restart_action": {
            "$ref": "common.schema.json#/$defs/RestartAction"
          },
          "attempt": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1000
          },
          "allocation_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/common.schema.json#/$defs/AllocationId"
          },
          "receipt_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/common.schema.json#/$defs/NodeAllocationReceiptId"
          },
          "workflow": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/common.schema.json#/$defs/WorkflowNodeRef"
          },
          "artifact": {
            "description": "The durable take (Storage object pinned by checksum) once one exists; null before.",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/common.schema.json#/$defs/ArtifactRef"
              }
            ]
          },
          "execution_pin": {
            "description": "The P00-09 pin of the operation's logical execution; never re-resolved on restart.",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/common.schema.json#/$defs/ExecutionPinRef"
              }
            ]
          },
          "lineage": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/common.schema.json#/$defs/Lineage"
          }
        },
        "allOf": [
          {
            "description": "A durable take pins its Storage object.",
            "if": {
              "properties": {
                "stage": {
                  "enum": [
                    "take_stored",
                    "take_applied",
                    "take_attention"
                  ]
                }
              }
            },
            "then": {
              "properties": {
                "artifact": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/common.schema.json#/$defs/ArtifactRef"
                }
              }
            }
          },
          {
            "description": "No durable take exists before or without one.",
            "if": {
              "properties": {
                "stage": {
                  "enum": [
                    "queued",
                    "in_flight",
                    "outcome_unknown",
                    "failed_no_take"
                  ]
                }
              }
            },
            "then": {
              "properties": {
                "artifact": {
                  "type": "null"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "stage": {
                  "const": "queued"
                }
              }
            },
            "then": {
              "properties": {
                "restart_action": {
                  "enum": [
                    "start",
                    "replan_required"
                  ]
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "stage": {
                  "const": "in_flight"
                }
              }
            },
            "then": {
              "properties": {
                "restart_action": {
                  "enum": [
                    "resume_same_workflow",
                    "replan_required"
                  ]
                }
              }
            }
          },
          {
            "description": "An unknown outcome is reconciled with the same allocation and receipt; it is never submitted again.",
            "if": {
              "properties": {
                "stage": {
                  "const": "outcome_unknown"
                }
              }
            },
            "then": {
              "properties": {
                "restart_action": {
                  "enum": [
                    "reconcile_only",
                    "replan_required"
                  ]
                }
              }
            }
          },
          {
            "description": "An accepted take is never regenerated: it is applied or kept, whatever the current stable implementation is.",
            "if": {
              "properties": {
                "stage": {
                  "const": "take_stored"
                }
              }
            },
            "then": {
              "properties": {
                "restart_action": {
                  "const": "apply_take"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "stage": {
                  "const": "take_applied"
                }
              }
            },
            "then": {
              "properties": {
                "restart_action": {
                  "const": "keep_take"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "stage": {
                  "const": "take_attention"
                }
              }
            },
            "then": {
              "properties": {
                "restart_action": {
                  "const": "keep_take_attention"
                }
              }
            }
          },
          {
            "description": "A failed operation is retried only by an explicit user retry (a new operation), never automatically and never paid silently.",
            "if": {
              "properties": {
                "stage": {
                  "const": "failed_no_take"
                }
              }
            },
            "then": {
              "properties": {
                "restart_action": {
                  "enum": [
                    "user_retry_only",
                    "replan_required"
                  ]
                }
              }
            }
          }
        ]
      }
    }
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
  },
  "execution-pin/v1/execution-pin-package.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/execution-pin/v1/execution-pin-package.schema.json",
    "title": "Execution pin package (P00-09)",
    "description": "Server-owned, immutable pin package that estimate -> G1 approval fingerprint -> launch -> recovery carry unchanged for one logical execution. Reuses workflow-engine/app/node_impl.py:NodeImplPin and api-gateway/src/workflow/domain/types/workflow-node-versioning.types.ts:WorkflowNodeImplPin field-for-field; adds no new per-node field.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "node_impl_pins",
      "execution_dsl_hash",
      "pin_fingerprint_hash",
      "pinned_at",
      "source_estimate_ref"
    ],
    "properties": {
      "schema_version": {
        "const": "1"
      },
      "node_impl_pins": {
        "description": "Keyed by opaque DSL node_key, same shape as resolve_impl_pins()'s return value (workflow-engine/app/node_impl.py:92-111) and WorkflowNodeImplPins (workflow-node-versioning.types.ts:3-14).",
        "type": "object",
        "minProperties": 1,
        "additionalProperties": {
          "$ref": "#/$defs/node_impl_pin"
        }
      },
      "execution_dsl_hash": {
        "description": "Same value as WorkflowEstimateDTO.execution_dsl_hash (i-workflow-estimate.repository.port.ts:30): the Gateway stableJsonHash / implPinning.fingerprint() output (workflow-hash.service.ts:9-14, workflow-node-impl-pinning.service.ts:59-66), i.e. lowercase sha256 hex without prefix.",
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "pin_fingerprint_hash": {
        "description": "stableJsonHash({execution_dsl_hash, node_impl_pins}) exactly as the Gateway computes it (workflow-hash.service.ts stableStringify: sorted keys, compact, no ASCII escaping; sha256 lowercase hex WITHOUT prefix). Python twin: json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False). A TypeScript-computed golden vector pins the byte equality (pin-rules.json fingerprint.golden_vectors). It is a new, separate field: the retry audit value node_impl_pins_hash (retry-workflow.use-case.ts:104-106) hashes node_impl_pins only and stays as it is. MUST NOT depend on mcp_metadata_revision or any stage-record field.",
        "type": "string",
        "pattern": "^[a-f0-9]{64}$"
      },
      "pinned_at": {
        "description": "When this package was produced (estimate creation time; unchanged by later stages that merely carry it).",
        "type": "string",
        "format": "date-time"
      },
      "source_estimate_ref": {
        "description": "Typed pointer to the owning estimate row (WorkflowEstimateDTO.id/tenant_id, i-workflow-estimate.repository.port.ts:32-33). Not a $ref across packages; P00-03 owns the job/run fields that this estimate is attached to.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "tenant_id",
          "estimate_id"
        ],
        "properties": {
          "tenant_id": {
            "type": "string",
            "minLength": 1
          },
          "estimate_id": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    },
    "$defs": {
      "node_impl_pin": {
        "description": "Field-for-field mirror of NodeImplPin (workflow-engine/app/node_impl.py:16-26) and WorkflowNodeImplPin (workflow-node-versioning.types.ts:3-14).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "type",
          "impl_revision",
          "schema_hash",
          "contract_hash",
          "pricing_hash"
        ],
        "properties": {
          "type": {
            "description": "node_type@version, e.g. video_generate@2.",
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(?:\\.[a-z][a-z0-9_]*)*@\\d+$"
          },
          "impl_revision": {
            "type": "integer",
            "minimum": 1
          },
          "schema_hash": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "contract_hash": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "pricing_hash": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "image_digest": {
            "type": "string",
            "pattern": "^sha256:[a-f0-9]{64}$"
          },
          "task_queue": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
          },
          "recipe_revision": {
            "type": "integer",
            "minimum": 1
          },
          "child_node_keys": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "if": {
          "properties": {
            "task_queue": {
              "type": "string"
            }
          },
          "required": [
            "task_queue"
          ]
        },
        "then": {
          "required": [
            "image_digest"
          ]
        }
      }
    }
  },
  "production-execution/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/common.schema.json",
    "title": "production_execution_common_v1",
    "description": "Shared definitions of the production-execution v1 package (P04-08 execution and cost binding of an approved plan's ProductionRun). Not a standalone document type. Ids, hashes and timestamps are owned by assistant-runtime v1; envelope ids and credit numbers by spend-envelope v1 (Billing stays the only spend/allocation authority); the ProductionRun record by composition-project v1 (production_run_v1).",
    "$defs": {
      "LogicalOperationKind": {
        "description": "FAZ-04 P04-08 logical operations of one job. planning/research/summary are Assistant inferences (charge_owner assistant, Chat reservation); the rest are Workflow nodes (charge_owner workflow, node reserve/settlement). execution-rules.json maps each kind to its charge owner and ProductionRun operation kind.",
        "enum": [
          "planning",
          "research",
          "summary",
          "tts",
          "generation",
          "qc_repair",
          "transform",
          "proxy_render",
          "final_render"
        ]
      },
      "ProductionLogicalOperationKind": {
        "description": "Kinds that are ProductionRun operations (Workflow nodes of the approved plan DAG).",
        "enum": [
          "tts",
          "generation",
          "qc_repair",
          "transform",
          "proxy_render",
          "final_render"
        ]
      },
      "ChargeOwner": {
        "description": "The single execution charge owner of one allocation (URETIM 2B, spend-envelope v1).",
        "enum": [
          "assistant",
          "workflow"
        ]
      },
      "AllocationId": {
        "type": "string",
        "pattern": "^alc_[A-Za-z0-9_-]{3,64}$"
      },
      "NodeAllocationReceiptId": {
        "description": "Workflow node allocation id (wca_<32 hex>): the single workflow_node_allocation receipt of one envelope allocation (alc_<same 32 hex>).",
        "type": "string",
        "pattern": "^wca_[0-9a-f]{32}$"
      },
      "WorkflowNodeRef": {
        "description": "The launched Workflow and the node of the approved plan DAG that executes the operation.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "workflow_id",
          "node_key"
        ],
        "properties": {
          "workflow_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "node_key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128,
            "pattern": "^[^\\s]+$"
          }
        }
      },
      "ArtifactRef": {
        "description": "The produced Storage object pinned by checksum (never a signed URL or file name).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storage_object_id",
          "checksum_sha256"
        ],
        "properties": {
          "storage_object_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "checksum_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "ModelMetadata": {
        "description": "Model metadata of the operation: the catalog model the approved plan requested and, when the provider reported it, the resolved model. Identifiers only; never keys, tokens, URLs or prompt text.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "requested_model_id"
        ],
        "properties": {
          "requested_model_id": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/ModelId"
              }
            ]
          },
          "resolved_model_id": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/ModelId"
              }
            ]
          },
          "provider_slug": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "string",
                "pattern": "^[a-z0-9][a-z0-9_.-]{0,63}$"
              }
            ]
          }
        }
      },
      "ModelId": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128,
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$"
      },
      "ExecutionPinRef": {
        "description": "P04-11: logical_execution_id (pex_<40 hex> of the approved plan revision + execution DSL hash) and the P00-09 pin_fingerprint_hash of its execution-pin-package.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "logical_execution_id",
          "pin_fingerprint_hash"
        ],
        "properties": {
          "logical_execution_id": {
            "type": "string",
            "pattern": "^pex_[0-9a-f]{40}$"
          },
          "pin_fingerprint_hash": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/execution-pin/v1/execution-pin-package.schema.json#/properties/pin_fingerprint_hash"
          }
        }
      },
      "Lineage": {
        "description": "Where the operation comes from. A user retry is a new operation naming the one it retries (retry_of_operation_id); a recovery keeps the same operation, attempt and allocation (no lineage change).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "planned_shot_id",
          "generation_shot_id",
          "retry_of_operation_id"
        ],
        "properties": {
          "planned_shot_id": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              }
            ]
          },
          "generation_shot_id": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              }
            ]
          },
          "retry_of_operation_id": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              }
            ]
          }
        }
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["long-run-checkpoint", "long-run-continuation", "long-run-result-page"] as const;
export type DocumentType = "long-run-checkpoint" | "long-run-continuation" | "long-run-result-page";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "long-run-checkpoint": [
    "long_run_checkpoint_v1"
  ],
  "long-run-continuation": [
    "long_run_continuation_v1"
  ],
  "long-run-result-page": [
    "long_run_result_page_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type LongRunCheckpoint = {
    readonly "schema_version": "long_run_checkpoint_v1";
    readonly "production_run_id": unknown;
    readonly "business_job_id": unknown;
    readonly "envelope_id": unknown;
    readonly "run_state": "planned" | "running" | "partial" | "succeeded" | "failed" | "canceled";
    readonly "operation_count": number;
    readonly "stage_counts": unknown;
    readonly "executions": readonly (unknown)[];
    readonly "stage_digest_sha256": unknown;
    readonly "recorded_at": unknown;
  };
export type LongRunContinuation = {
    readonly "schema_version": "long_run_continuation_v1";
    readonly "workflow_id": unknown;
    readonly "continuation_index": number;
    readonly "source_run_id": string;
    readonly "trigger": "history_threshold" | "server_suggested";
    readonly "history_events": number;
    readonly "original": {
    readonly "started_at": unknown;
    readonly "execution_deadline_at": unknown;
    readonly "launch_idempotency_key_sha256": (null) | (unknown);
  };
    readonly "billing": {
    readonly "workflow_reservation_id": (null) | (unknown);
    readonly "estimate_id": (null) | (unknown);
    readonly "node_cost_estimates_sha256": unknown;
  };
    readonly "pins": {
    readonly "node_impl_pins_sha256": unknown;
    readonly "execution_dsl_sha256": unknown;
  };
    readonly "accepted": {
    readonly "checkpointed_node_count": number;
    readonly "checkpointed_nodes_sha256": unknown;
  };
    readonly "carried": {
    readonly "resume_checkpoint_id": string;
    readonly "input_bytes": number;
    readonly "state_bytes": number;
  };
    readonly "exclusions": {
    readonly "assistant_history": "not_carried";
    readonly "prompt_text": "not_carried";
    readonly "node_outputs_inline": "not_carried";
  };
    readonly "recorded_at": unknown;
  };
export type LongRunResultPage = {
    readonly "schema_version": "long_run_result_page_v1";
    readonly "production_run_id": unknown;
    readonly "checkpoint_digest_sha256": unknown;
    readonly "operation_count": number;
    readonly "range": {
    readonly "start": number;
    readonly "end": number;
  };
    readonly "items": readonly (unknown)[];
    readonly "next_cursor": (null) | (string);
  };

export const reader = new ContractPackageReader({
  package: "long-run",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
