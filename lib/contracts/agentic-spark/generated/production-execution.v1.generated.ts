// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/production-execution/v1
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
  },
  "production-execution-view.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/production-execution-view.schema.json",
    "title": "production_execution_view_v1",
    "description": "Owner read of one ProductionRun's execution and cost (P04-08): the job envelope the Assistant job and the ProductionRun share (Billing figures, never recomputed here), every operation with its single allocation and charge owner, the checkpoints recorded so far, and the job's other allocations (Assistant planning/research/summary inferences) of the same envelope. A projection only: Billing owns amounts, Composition owns operations.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "production_run_id",
      "project_id",
      "business_job_id",
      "run_state",
      "envelope",
      "operations",
      "other_allocations"
    ],
    "properties": {
      "schema_version": {
        "const": "production_execution_view_v1"
      },
      "production_run_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CompositionProjectId"
      },
      "business_job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "run_state": {
        "enum": [
          "planned",
          "running",
          "partial",
          "succeeded",
          "failed",
          "canceled"
        ]
      },
      "envelope": {
        "description": "unavailable: Billing could not be read now; figures are absent, never guessed or zeroed.",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "read",
              "envelope_id",
              "status",
              "approved_max_credits",
              "spent",
              "outstanding_authorized_allocations",
              "outcome_unknown",
              "remaining_allocatable",
              "wallet_held",
              "funding_buffer"
            ],
            "properties": {
              "read": {
                "const": "ok"
              },
              "envelope_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/EnvelopeId"
              },
              "status": {
                "enum": [
                  "open",
                  "draining",
                  "closed"
                ]
              },
              "approved_max_credits": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
              },
              "spent": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
              },
              "outstanding_authorized_allocations": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
              },
              "outcome_unknown": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
              },
              "remaining_allocatable": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
              },
              "wallet_held": {
                "description": "Real wallet block; display only, never spend authority.",
                "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
              },
              "funding_buffer": {
                "description": "Workflow 10% parent buffer and planner safety margin; wallet reserve capacity, never extra spend permission.",
                "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "read",
              "envelope_id"
            ],
            "properties": {
              "read": {
                "const": "unavailable"
              },
              "envelope_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/EnvelopeId"
              }
            }
          }
        ]
      },
      "operations": {
        "type": "array",
        "maxItems": 64,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "operation_id",
            "logical_kind",
            "state",
            "apply_outcome",
            "workflow",
            "allocation",
            "lineage",
            "checkpoint_ids"
          ],
          "properties": {
            "operation_id": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
            },
            "logical_kind": {
              "$ref": "common.schema.json#/$defs/ProductionLogicalOperationKind"
            },
            "state": {
              "enum": [
                "queued",
                "dispatched",
                "succeeded",
                "failed",
                "canceled",
                "outcome_unknown",
                "abandoned"
              ]
            },
            "apply_outcome": {
              "enum": [
                "pending",
                "applied",
                "rebased",
                "conflict",
                "orphaned",
                "superseded",
                "detached",
                "invalidated"
              ]
            },
            "workflow": {
              "description": "null until the operation is dispatched to its Workflow.",
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "$ref": "common.schema.json#/$defs/WorkflowNodeRef"
                }
              ]
            },
            "allocation": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "allocation_id",
                "charge_owner",
                "status"
              ],
              "properties": {
                "allocation_id": {
                  "oneOf": [
                    {
                      "type": "null"
                    },
                    {
                      "$ref": "common.schema.json#/$defs/AllocationId"
                    }
                  ]
                },
                "charge_owner": {
                  "const": "workflow"
                },
                "status": {
                  "description": "Billing allocation status; not_requested until the node asked Billing, unavailable when Billing could not be read.",
                  "enum": [
                    "not_requested",
                    "authorized",
                    "dispatched",
                    "outcome_unknown",
                    "settled",
                    "abandoned",
                    "released",
                    "unavailable"
                  ]
                },
                "allocated_credits": {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
                },
                "settled_credits": {
                  "oneOf": [
                    {
                      "type": "null"
                    },
                    {
                      "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
                    }
                  ]
                }
              }
            },
            "lineage": {
              "$ref": "common.schema.json#/$defs/Lineage"
            },
            "checkpoint_ids": {
              "type": "array",
              "maxItems": 16,
              "uniqueItems": true,
              "items": {
                "type": "string",
                "pattern": "^pck_[0-9a-f]{40}$"
              }
            }
          }
        }
      },
      "other_allocations": {
        "description": "Allocations of the same envelope that belong to no ProductionRun operation (Assistant planning/research/summary, the final render allocation of P03-10). Shown so the shared envelope is visible as one budget.",
        "type": "array",
        "maxItems": 200,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "allocation_id",
            "logical_operation_id",
            "charge_owner",
            "status",
            "allocated_credits"
          ],
          "properties": {
            "allocation_id": {
              "$ref": "common.schema.json#/$defs/AllocationId"
            },
            "logical_operation_id": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
            },
            "charge_owner": {
              "$ref": "common.schema.json#/$defs/ChargeOwner"
            },
            "status": {
              "enum": [
                "authorized",
                "dispatched",
                "outcome_unknown",
                "settled",
                "abandoned",
                "released"
              ]
            },
            "allocated_credits": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
            },
            "settled_credits": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/Credits"
                }
              ]
            }
          }
        }
      }
    }
  },
  "production-operation-checkpoint.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/production-execution/v1/production-operation-checkpoint.schema.json",
    "title": "production_operation_checkpoint_v1",
    "description": "One execution checkpoint of a ProductionRun operation (P04-08): the terminal delivery of one attempt of one logical operation, bound to the job's envelope, the operation's single Billing allocation, the charge owner's receipt, the executing Workflow node, the produced artifact, model metadata, the prompt/input hash and the lineage. It is a record of refs, never a second ledger: amounts and allocation status are read from Billing. The checkpoint is written with the completion inbox row (one per delivery) and is never rewritten.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "checkpoint_id",
      "production_run_id",
      "business_job_id",
      "envelope_id",
      "operation_id",
      "logical_kind",
      "attempt",
      "charge_owner",
      "allocation_id",
      "receipt",
      "workflow",
      "outcome",
      "artifact",
      "model",
      "input_hash",
      "lineage",
      "recorded_at"
    ],
    "properties": {
      "schema_version": {
        "const": "production_operation_checkpoint_v1"
      },
      "checkpoint_id": {
        "type": "string",
        "pattern": "^pck_[0-9a-f]{40}$"
      },
      "production_run_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "business_job_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "envelope_id": {
        "description": "The job's envelope (Assistant job and ProductionRun share it).",
        "$ref": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json#/$defs/EnvelopeId"
      },
      "operation_id": {
        "description": "P00-03 logical operation id of the Workflow node (wfnode_<40 hex> of workflow id + node key); the same id Billing records on the allocation.",
        "type": "string",
        "pattern": "^wfnode_[0-9a-f]{40}$"
      },
      "logical_kind": {
        "$ref": "common.schema.json#/$defs/ProductionLogicalOperationKind"
      },
      "attempt": {
        "description": "Attempt of the logical operation. A recovery keeps the attempt (same allocation, same receipt); only the charge owner opens a new attempt.",
        "type": "integer",
        "minimum": 1,
        "maximum": 1000
      },
      "charge_owner": {
        "$ref": "common.schema.json#/$defs/ChargeOwner"
      },
      "allocation_id": {
        "$ref": "common.schema.json#/$defs/AllocationId"
      },
      "receipt": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "receipt_kind",
          "receipt_id"
        ],
        "properties": {
          "receipt_kind": {
            "const": "workflow_node_allocation"
          },
          "receipt_id": {
            "$ref": "common.schema.json#/$defs/NodeAllocationReceiptId"
          }
        }
      },
      "workflow": {
        "$ref": "common.schema.json#/$defs/WorkflowNodeRef"
      },
      "outcome": {
        "description": "Terminal delivery of the attempt. outcome_unknown keeps the allocation outstanding until evidenced reconciliation/refund; it is never a failure that frees capacity.",
        "enum": [
          "succeeded",
          "failed",
          "canceled",
          "outcome_unknown",
          "abandoned"
        ]
      },
      "artifact": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "common.schema.json#/$defs/ArtifactRef"
          }
        ]
      },
      "model": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "common.schema.json#/$defs/ModelMetadata"
          }
        ]
      },
      "input_hash": {
        "description": "sha256 of the node's canonical DSL params (the prompt hash). The prompt text itself is never stored in the checkpoint.",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        ]
      },
      "lineage": {
        "$ref": "common.schema.json#/$defs/Lineage"
      },
      "recorded_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "execution_pin": {
        "description": "P04-11: the P00-09 pin of the operation's logical execution (production_run_v1 Operation.execution_pin). Every delivery and recovery of the operation carries the same pin; a replan is a new logical execution.",
        "$ref": "common.schema.json#/$defs/ExecutionPinRef"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "outcome": {
              "const": "succeeded"
            }
          }
        },
        "then": {
          "properties": {
            "artifact": {
              "$ref": "common.schema.json#/$defs/ArtifactRef"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "outcome": {
              "enum": [
                "failed",
                "canceled",
                "outcome_unknown",
                "abandoned"
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
        "description": "Every ProductionRun operation is a Workflow node: its charge owner is the Workflow node reserve/settlement.",
        "properties": {
          "charge_owner": {
            "const": "workflow"
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
  "spend-envelope/v1/spend-envelope.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-envelope.schema.json",
    "title": "spend_envelope_v1",
    "description": "Billing-owned spend authorization envelope. One envelope per Assistant business job (shared with its Composition ProductionRun) or per Spark quick-AI edit session. It is the atomic ceiling and allocation authority, not a second monetary ledger: Chat reservation/settlement and Workflow parent/node settlement remain the only charge owners. Invariant (checked outside JSON Schema, see envelope-rules.json): spent + outstanding_authorized_allocations <= approved_max_credits. Credit numbers must be compared as decimals.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "envelope_id",
      "tenant_id",
      "envelope_kind",
      "subject",
      "funding_channel",
      "principal_id",
      "principal_kind",
      "quota_eligible",
      "launch_origin",
      "status",
      "authorization_phase",
      "approval_version",
      "approved_max_credits",
      "spent",
      "outstanding_authorized_allocations",
      "outcome_unknown",
      "remaining_allocatable",
      "wallet_held",
      "funding_buffer",
      "authorization",
      "authorization_history",
      "pending_approval_request",
      "created_at",
      "updated_at",
      "record_version"
    ],
    "properties": {
      "schema_version": {
        "const": 1
      },
      "envelope_id": {
        "$ref": "#/$defs/EnvelopeId"
      },
      "tenant_id": {
        "$ref": "#/$defs/OpaqueId"
      },
      "envelope_kind": {
        "description": "job: Assistant business job + its ProductionRun (Chat, Spark, Tools, render_only export, scheduled, API/MCP). edit_session: Spark quick-AI edit session (TK-14).",
        "enum": [
          "job",
          "edit_session"
        ]
      },
      "subject": {
        "oneOf": [
          {
            "$ref": "#/$defs/JobSubject"
          },
          {
            "$ref": "#/$defs/EditSessionSubject"
          }
        ]
      },
      "funding_channel": {
        "$ref": "#/$defs/FundingChannel"
      },
      "principal_id": {
        "description": "Paying principal (TK-15). app: the initiating user actor (F41); api/mcp: the external principal (DEVELOPER-PLATFORM 6.1).",
        "$ref": "#/$defs/OpaqueId"
      },
      "principal_kind": {
        "enum": [
          "user",
          "personal_key",
          "developer_app",
          "mcp_client"
        ]
      },
      "quota_eligible": {
        "description": "Plan quotas (included render minutes, quick-AI units, free entitlements) may be consumed only when true; true exactly for funding_channel app (TK-15, Q65).",
        "type": "boolean"
      },
      "launch_origin": {
        "description": "user_session: interactive app use. schedule/triggered: Q79 scheduled or event-triggered runs (for example a connector webhook), authorized by scheduled_bypass. external_principal: API/MCP.",
        "enum": [
          "user_session",
          "schedule",
          "triggered",
          "external_principal"
        ]
      },
      "status": {
        "enum": [
          "open",
          "draining",
          "closed"
        ]
      },
      "authorization_phase": {
        "$ref": "#/$defs/AuthorizationPhase"
      },
      "approval_version": {
        "description": "Version of the current ceiling; 0 until the first grant. Every ceiling change adds exactly one.",
        "type": "integer",
        "minimum": 0
      },
      "approved_max_credits": {
        "$ref": "#/$defs/Credits"
      },
      "spent": {
        "$ref": "#/$defs/Credits"
      },
      "outstanding_authorized_allocations": {
        "description": "Allocated but not yet settled or released; includes accepted and outcome_unknown obligations.",
        "$ref": "#/$defs/Credits"
      },
      "outcome_unknown": {
        "description": "Subset of outstanding_authorized_allocations whose provider outcome is unknown; never summed twice and never re-allocated before it is resolved.",
        "$ref": "#/$defs/Credits"
      },
      "remaining_allocatable": {
        "$ref": "#/$defs/Credits"
      },
      "wallet_held": {
        "description": "Real blocked wallet balance for this job. Display/funding projection only; not spend authority.",
        "$ref": "#/$defs/Credits"
      },
      "funding_buffer": {
        "description": "Workflow parent 10% buffer and planner reserve safety margin currently held. Display/funding projection only; not spend authority (B01, K90).",
        "$ref": "#/$defs/Credits"
      },
      "authorization": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Authorization"
          }
        ]
      },
      "authorization_history": {
        "description": "Earlier authorizations of this same envelope, approval_version 1..n-1 in order (G1 widening keeps the envelope_id).",
        "type": "array",
        "maxItems": 64,
        "items": {
          "$ref": "#/$defs/Authorization"
        }
      },
      "pending_approval_request": {
        "description": "The open ask_once, if any (Q73): an approval must carry this decision_id and requested_max_credits. Superseded by a later start/no_change/funding_required decision (envelope-rules.json pending_approval_rules).",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/PendingApprovalRequest"
          }
        ]
      },
      "created_at": {
        "$ref": "#/$defs/Timestamp"
      },
      "updated_at": {
        "$ref": "#/$defs/Timestamp"
      },
      "record_version": {
        "description": "Row CAS version of the envelope record.",
        "type": "integer",
        "minimum": 1
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "funding_channel": {
              "const": "app"
            }
          },
          "required": [
            "funding_channel"
          ]
        },
        "then": {
          "properties": {
            "principal_kind": {
              "const": "user"
            },
            "quota_eligible": {
              "const": true
            },
            "launch_origin": {
              "enum": [
                "user_session",
                "schedule",
                "triggered"
              ]
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "funding_channel": {
              "const": "api"
            }
          },
          "required": [
            "funding_channel"
          ]
        },
        "then": {
          "properties": {
            "principal_kind": {
              "enum": [
                "personal_key",
                "developer_app"
              ]
            },
            "quota_eligible": {
              "const": false
            },
            "launch_origin": {
              "const": "external_principal"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "funding_channel": {
              "const": "mcp"
            }
          },
          "required": [
            "funding_channel"
          ]
        },
        "then": {
          "properties": {
            "principal_kind": {
              "const": "mcp_client"
            },
            "quota_eligible": {
              "const": false
            },
            "launch_origin": {
              "const": "external_principal"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "envelope_kind": {
              "const": "edit_session"
            }
          },
          "required": [
            "envelope_kind"
          ]
        },
        "then": {
          "properties": {
            "funding_channel": {
              "const": "app"
            },
            "launch_origin": {
              "const": "user_session"
            },
            "authorization_phase": {
              "const": "session"
            },
            "subject": {
              "$ref": "#/$defs/EditSessionSubject"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "envelope_kind": {
              "const": "job"
            }
          },
          "required": [
            "envelope_kind"
          ]
        },
        "then": {
          "properties": {
            "authorization_phase": {
              "enum": [
                "preparation",
                "production"
              ]
            },
            "subject": {
              "$ref": "#/$defs/JobSubject"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "authorization": {
              "type": "null"
            }
          },
          "required": [
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "approved_max_credits": {
              "maximum": 0
            },
            "approval_version": {
              "const": 0
            },
            "authorization_history": {
              "maxItems": 0
            },
            "authorization_phase": {
              "enum": [
                "preparation",
                "session"
              ]
            }
          }
        },
        "else": {
          "properties": {
            "approval_version": {
              "minimum": 1
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "funding_channel": {
              "enum": [
                "api",
                "mcp"
              ]
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "funding_channel",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "const": "principal_bypass"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "launch_origin": {
              "enum": [
                "schedule",
                "triggered"
              ]
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "launch_origin",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "const": "scheduled_bypass"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "launch_origin": {
              "const": "user_session"
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "launch_origin",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "enum": [
                    "preparation_grant",
                    "mode_snapshot",
                    "user_approval"
                  ]
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "authorization_phase": {
              "const": "preparation"
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "authorization_phase",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "const": "preparation_grant"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "authorization_phase": {
              "const": "production"
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "authorization_phase",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "enum": [
                    "mode_snapshot",
                    "user_approval",
                    "scheduled_bypass",
                    "principal_bypass"
                  ]
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "authorization_phase": {
              "const": "session"
            },
            "authorization": {
              "type": "object"
            }
          },
          "required": [
            "authorization_phase",
            "authorization"
          ]
        },
        "then": {
          "properties": {
            "authorization": {
              "properties": {
                "basis": {
                  "enum": [
                    "mode_snapshot",
                    "user_approval"
                  ]
                },
                "estimate": {
                  "properties": {
                    "source": {
                      "const": "edit_session_policy_cap"
                    }
                  }
                }
              }
            },
            "authorization_history": {
              "items": {
                "properties": {
                  "estimate": {
                    "properties": {
                      "source": {
                        "const": "edit_session_policy_cap"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "else": {
          "properties": {
            "authorization": {
              "properties": {
                "estimate": {
                  "properties": {
                    "source": {
                      "const": "server_cold_max_output"
                    }
                  }
                }
              }
            },
            "authorization_history": {
              "items": {
                "properties": {
                  "estimate": {
                    "properties": {
                      "source": {
                        "const": "server_cold_max_output"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ],
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "EnvelopeId": {
        "type": "string",
        "pattern": "^env_[A-Za-z0-9_-]{3,64}$"
      },
      "CompositionProjectId": {
        "description": "Composition project id (Spark project entry, PR #294: private, tenant + owner scoped).",
        "type": "string",
        "pattern": "^cprj_[0-9a-f-]{36}$"
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Credits": {
        "description": "Credit amount on the existing Billing CreditAmount boundary: non-negative, 4 decimal places (0.0001), within the Workflow safe four-decimal range.",
        "type": "number",
        "minimum": 0,
        "maximum": 900719925474.0991,
        "multipleOf": 0.0001
      },
      "FundingChannel": {
        "description": "app = Chat/Spark/Tools/scheduled, api, mcp (TK-15).",
        "enum": [
          "app",
          "api",
          "mcp"
        ]
      },
      "AuthorizationPhase": {
        "description": "preparation: before G1, bounded preparation grant (F31). production: after G1 (or bypass admission). session: edit_session envelope.",
        "enum": [
          "preparation",
          "production",
          "session"
        ]
      },
      "Mode": {
        "description": "Canonical mode (F24/Q74); the mode table itself is owned by P00-13.",
        "enum": [
          "ask",
          "auto",
          "auto_full"
        ]
      },
      "JobSubject": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "business_job_id",
          "production_run_id",
          "project_id"
        ],
        "properties": {
          "business_job_id": {
            "$ref": "#/$defs/OpaqueId"
          },
          "production_run_id": {
            "description": "Composition ProductionRun bound to this same envelope; null until it exists.",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/OpaqueId"
              }
            ]
          },
          "project_id": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/CompositionProjectId"
              }
            ]
          }
        }
      },
      "EditSessionSubject": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "edit_session_id",
          "project_id"
        ],
        "properties": {
          "edit_session_id": {
            "$ref": "#/$defs/OpaqueId"
          },
          "project_id": {
            "$ref": "#/$defs/CompositionProjectId"
          }
        }
      },
      "ModeSnapshot": {
        "description": "Mode in force when the grant was derived or approved (audit: 'derived from mode snapshot', Q70).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "mode",
          "settings_ref"
        ],
        "properties": {
          "mode": {
            "$ref": "#/$defs/Mode"
          },
          "settings_ref": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "version"
            ],
            "properties": {
              "kind": {
                "description": "job_settings for jobs, conversation_defaults for edit sessions (versions owned by P00-11).",
                "enum": [
                  "job_settings",
                  "conversation_defaults"
                ]
              },
              "version": {
                "type": "integer",
                "minimum": 1
              }
            }
          }
        }
      },
      "EstimateRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "estimate_revision",
          "total_upper_bound_credits",
          "source"
        ],
        "properties": {
          "estimate_revision": {
            "$ref": "#/$defs/OpaqueId"
          },
          "total_upper_bound_credits": {
            "description": "Server cold/max-output/allowed retry/repair/proxy/render total for the job, including credits already spent (B01). The LLM never supplies this number.",
            "$ref": "#/$defs/Credits"
          },
          "source": {
            "description": "server_cold_max_output for jobs; edit_session_policy_cap for edit sessions (per-plan Feature Control spark_quick_ai_session_max_credits; coordinator decision 26 Sep 2026, value is config).",
            "enum": [
              "server_cold_max_output",
              "edit_session_policy_cap"
            ]
          }
        }
      },
      "PreparationCap": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "source",
          "subscription_plan_revision",
          "cap_credits"
        ],
        "properties": {
          "source": {
            "const": "feature_control_plan_and_user_policy"
          },
          "subscription_plan_revision": {
            "$ref": "#/$defs/OpaqueId"
          },
          "cap_credits": {
            "$ref": "#/$defs/Credits"
          }
        }
      },
      "PendingApprovalRequest": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "decision_id",
          "requested_max_credits",
          "trigger",
          "asked_in_mode"
        ],
        "properties": {
          "decision_id": {
            "description": "Review request id the approval must answer.",
            "$ref": "#/$defs/OpaqueId"
          },
          "requested_max_credits": {
            "$ref": "#/$defs/Credits"
          },
          "trigger": {
            "enum": [
              "g1",
              "reestimate",
              "edit_session_charge"
            ]
          },
          "asked_in_mode": {
            "description": "Mode the question was asked in; user_approval.mode_snapshot records it. auto_full never asks.",
            "enum": [
              "ask",
              "auto"
            ]
          }
        }
      },
      "DecisionRef": {
        "description": "Canonical Review request decision that approved the amount (F17).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "decision_id",
          "decision_version"
        ],
        "properties": {
          "decision_id": {
            "$ref": "#/$defs/OpaqueId"
          },
          "decision_version": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "Authorization": {
        "description": "One versioned ceiling grant. basis is the audit reason: preparation_grant (bounded pre-G1 grant from Feature Control + user policy), mode_snapshot (auto/auto_full derived, no question, Q70), user_approval (Ask, or auto at/above 75%, or Q73 re-ask), scheduled_bypass (Q79), principal_bypass (API/MCP, Q74).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "approval_version",
          "basis",
          "approved_max_credits",
          "mode_snapshot",
          "estimate",
          "preparation_cap",
          "principal_job_cap_credits",
          "decision_ref",
          "granted_at"
        ],
        "properties": {
          "approval_version": {
            "type": "integer",
            "minimum": 1
          },
          "basis": {
            "enum": [
              "preparation_grant",
              "mode_snapshot",
              "user_approval",
              "scheduled_bypass",
              "principal_bypass"
            ]
          },
          "approved_max_credits": {
            "$ref": "#/$defs/Credits"
          },
          "mode_snapshot": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/ModeSnapshot"
              }
            ]
          },
          "estimate": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/EstimateRef"
              }
            ]
          },
          "preparation_cap": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/PreparationCap"
              }
            ]
          },
          "principal_job_cap_credits": {
            "description": "Principal per-job cap in force (values owned by DEV-12); only for principal_bypass.",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/Credits"
              }
            ]
          },
          "decision_ref": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "$ref": "#/$defs/DecisionRef"
              }
            ]
          },
          "granted_at": {
            "$ref": "#/$defs/Timestamp"
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "preparation_grant"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "mode_snapshot": {
                  "$ref": "#/$defs/ModeSnapshot"
                },
                "estimate": {
                  "type": "null"
                },
                "preparation_cap": {
                  "$ref": "#/$defs/PreparationCap"
                },
                "principal_job_cap_credits": {
                  "type": "null"
                },
                "decision_ref": {
                  "type": "null"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "mode_snapshot"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "mode_snapshot": {
                  "allOf": [
                    {
                      "$ref": "#/$defs/ModeSnapshot"
                    },
                    {
                      "properties": {
                        "mode": {
                          "enum": [
                            "auto",
                            "auto_full"
                          ]
                        }
                      }
                    }
                  ]
                },
                "estimate": {
                  "$ref": "#/$defs/EstimateRef"
                },
                "preparation_cap": {
                  "type": "null"
                },
                "principal_job_cap_credits": {
                  "type": "null"
                },
                "decision_ref": {
                  "type": "null"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "user_approval"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "mode_snapshot": {
                  "allOf": [
                    {
                      "$ref": "#/$defs/ModeSnapshot"
                    },
                    {
                      "properties": {
                        "mode": {
                          "enum": [
                            "ask",
                            "auto"
                          ]
                        }
                      }
                    }
                  ]
                },
                "estimate": {
                  "$ref": "#/$defs/EstimateRef"
                },
                "preparation_cap": {
                  "type": "null"
                },
                "principal_job_cap_credits": {
                  "type": "null"
                },
                "decision_ref": {
                  "$ref": "#/$defs/DecisionRef"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "scheduled_bypass"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "mode_snapshot": {
                  "type": "null"
                },
                "estimate": {
                  "$ref": "#/$defs/EstimateRef"
                },
                "preparation_cap": {
                  "type": "null"
                },
                "principal_job_cap_credits": {
                  "type": "null"
                },
                "decision_ref": {
                  "type": "null"
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "principal_bypass"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "mode_snapshot": {
                  "type": "null"
                },
                "estimate": {
                  "$ref": "#/$defs/EstimateRef"
                },
                "preparation_cap": {
                  "type": "null"
                },
                "principal_job_cap_credits": {
                  "$ref": "#/$defs/Credits"
                },
                "decision_ref": {
                  "type": "null"
                }
              }
            }
          }
        ]
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["production-execution-view", "production-operation-checkpoint"] as const;
export type DocumentType = "production-execution-view" | "production-operation-checkpoint";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "production-execution-view": [
    "production_execution_view_v1"
  ],
  "production-operation-checkpoint": [
    "production_operation_checkpoint_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type ProductionExecutionView = {
    readonly "schema_version": "production_execution_view_v1";
    readonly "production_run_id": unknown;
    readonly "project_id": unknown;
    readonly "business_job_id": unknown;
    readonly "run_state": "planned" | "running" | "partial" | "succeeded" | "failed" | "canceled";
    readonly "envelope": ({
    readonly "read": "ok";
    readonly "envelope_id": unknown;
    readonly "status": "open" | "draining" | "closed";
    readonly "approved_max_credits": unknown;
    readonly "spent": unknown;
    readonly "outstanding_authorized_allocations": unknown;
    readonly "outcome_unknown": unknown;
    readonly "remaining_allocatable": unknown;
    readonly "wallet_held": unknown;
    readonly "funding_buffer": unknown;
  }) | ({
    readonly "read": "unavailable";
    readonly "envelope_id": unknown;
  });
    readonly "operations": readonly ({
    readonly "operation_id": unknown;
    readonly "logical_kind": "tts" | "generation" | "qc_repair" | "transform" | "proxy_render" | "final_render";
    readonly "state": "queued" | "dispatched" | "succeeded" | "failed" | "canceled" | "outcome_unknown" | "abandoned";
    readonly "apply_outcome": "pending" | "applied" | "rebased" | "conflict" | "orphaned" | "superseded" | "detached" | "invalidated";
    readonly "workflow": (null) | (unknown);
    readonly "allocation": {
    readonly "allocation_id": (null) | (string);
    readonly "charge_owner": "workflow";
    readonly "status": "not_requested" | "authorized" | "dispatched" | "outcome_unknown" | "settled" | "abandoned" | "released" | "unavailable";
    readonly "allocated_credits"?: unknown;
    readonly "settled_credits"?: (null) | (unknown);
  };
    readonly "lineage": unknown;
    readonly "checkpoint_ids": readonly (string)[];
  })[];
    readonly "other_allocations": readonly ({
    readonly "allocation_id": string;
    readonly "logical_operation_id": unknown;
    readonly "charge_owner": "assistant" | "workflow";
    readonly "status": "authorized" | "dispatched" | "outcome_unknown" | "settled" | "abandoned" | "released";
    readonly "allocated_credits": unknown;
    readonly "settled_credits"?: (null) | (unknown);
  })[];
  };
export type ProductionOperationCheckpoint = {
    readonly "schema_version": "production_operation_checkpoint_v1";
    readonly "checkpoint_id": string;
    readonly "production_run_id": unknown;
    readonly "business_job_id": unknown;
    readonly "envelope_id": unknown;
    readonly "operation_id": string;
    readonly "logical_kind": "tts" | "generation" | "qc_repair" | "transform" | "proxy_render" | "final_render";
    readonly "attempt": number;
    readonly "charge_owner": "assistant" | "workflow";
    readonly "allocation_id": string;
    readonly "receipt": {
    readonly "receipt_kind": "workflow_node_allocation";
    readonly "receipt_id": string;
  };
    readonly "workflow": unknown;
    readonly "outcome": "succeeded" | "failed" | "canceled" | "outcome_unknown" | "abandoned";
    readonly "artifact": (null) | (unknown);
    readonly "model": (null) | (unknown);
    readonly "input_hash": (null) | (unknown);
    readonly "lineage": unknown;
    readonly "recorded_at": unknown;
    readonly "execution_pin"?: unknown;
  };

export const reader = new ContractPackageReader({
  package: "production-execution",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
