// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/execution-pin/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "execution-pin-package.schema.json": {
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
  "execution-pin-stage.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/execution-pin/v1/execution-pin-stage.schema.json",
    "title": "Execution pin stage record (P00-09)",
    "description": "One observation of the execution-pin-package at a stage of estimate -> approval fingerprint (G1/G2, human/policy) -> launch -> recovery, or a terminal replan_required record. logical_execution_id is the estimate id (review + coordinator decision, 26 Sep 2026); launch/recovery also carry P00-03 logical_operation_id and workflow_id. K88: 'Her logical execution'da ayni node_impl_pins/execution_dsl_hash estimate->launch->recovery; distinct proxy/final DAG hash esitligi aranmaz.' Pin equality is scoped to ONE logical execution; a proxy render and a final render are separate estimates.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "logical_execution_id",
      "stage",
      "occurred_at"
    ],
    "properties": {
      "schema_version": {
        "const": "1"
      },
      "logical_execution_id": {
        "description": "Equals pin_package.source_estimate_ref.estimate_id (review + coordinator decision, 26 Sep 2026): one estimate = one logical execution. A replan starts a new estimate and so a new logical execution; a proxy render and a final render are separate estimates. Pin equality is scoped to one logical_execution_id (K88 second half). Not P00-03's logical_operation_id; see the launch/recovery fields.",
        "type": "string",
        "minLength": 1
      },
      "stage": {
        "description": "estimate -> approval_fingerprint -> launch -> recovery (repeatable) with no gaps, or the terminal replan_required.",
        "enum": [
          "estimate",
          "approval_fingerprint",
          "launch",
          "recovery",
          "replan_required"
        ]
      },
      "gate": {
        "description": "Only on approval_fingerprint: g1 = production/spend decision on the plan, g2 = final render of the exact seen revision (KARAR-URETIM-KARTLARI \u00a72).",
        "enum": [
          "g1",
          "g2"
        ]
      },
      "decision_source": {
        "description": "Only on approval_fingerprint: human = canonical Review decision; policy = mode/bypass policy decision (auto, auto_full, API/MCP, scheduled; P00-13 mode table, P00-10 grant). A proxy preview inside an approved production scope is a policy G1 fingerprint.",
        "enum": [
          "human",
          "policy"
        ]
      },
      "occurred_at": {
        "type": "string",
        "format": "date-time"
      },
      "logical_operation_id": {
        "description": "Launch/recovery only: P00-03 logical_operation_id of the Workflow launch (idempotent operation; recovery keeps it, attempts change).",
        "type": "string",
        "minLength": 1
      },
      "workflow_id": {
        "description": "Launch/recovery only: the Workflow run launched by this stage (a retry launches a new workflow).",
        "type": "string",
        "minLength": 1
      },
      "original_workflow_id": {
        "description": "Recovery only: workflow_id of the launch being recovered (retry-workflow.use-case.ts original_workflow_id).",
        "type": "string",
        "minLength": 1
      },
      "pin_package": {
        "$ref": "execution-pin-package.schema.json"
      },
      "release_channel_snapshot": {
        "description": "Only meaningful at stage=estimate: which release channel (stable/canary/internal) NodeReleaseChannelManager.resolve() (workflow-engine/app/node_impl.py:236-250) / resolveNodeImplPins() (workflow-node-impl-pins.service.ts:71-135) consulted per node_type when this package was first resolved. Later stages never re-resolve a channel for an existing pin, so this field is absent there (see pin-rules.json inv_channel_snapshot_only_at_estimate).",
        "type": "object",
        "additionalProperties": {
          "enum": [
            "stable",
            "canary",
            "internal"
          ]
        }
      },
      "mcp_metadata_revision": {
        "description": "Remote MCP tool/server metadata revision observed at this stage, if any (Discovery/Connector territory, referenced here only by name). A separate namespace from the pin package: it MUST NOT be folded into pin_fingerprint_hash or used as a substitute pin-equality check (Q99/TK-11 boundary; FAZ-00 P00-09: 'Remote MCP metadata revision'i bu execution pin ile esitlenmez').",
        "type": [
          "string",
          "null"
        ]
      },
      "replan_reason": {
        "description": "Required and only allowed when stage=replan_required. The two real non-retryable error codes that force an open replan instead of a silent fallback (workflow-engine/domain/errors.py:153-176: NodeImplRevisionUnavailableError.code, NodeImplPinInvalidError.code).",
        "enum": [
          "node_impl_revision_unavailable",
          "node_impl_pin_invalid"
        ]
      }
    },
    "if": {
      "properties": {
        "stage": {
          "const": "replan_required"
        }
      },
      "required": [
        "stage"
      ]
    },
    "then": {
      "required": [
        "replan_reason"
      ]
    },
    "else": {
      "not": {
        "required": [
          "replan_reason"
        ]
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "stage": {
              "enum": [
                "estimate",
                "approval_fingerprint",
                "launch",
                "recovery"
              ]
            }
          },
          "required": [
            "stage"
          ]
        },
        "then": {
          "required": [
            "pin_package"
          ]
        }
      },
      {
        "if": {
          "not": {
            "properties": {
              "stage": {
                "const": "estimate"
              }
            },
            "required": [
              "stage"
            ]
          }
        },
        "then": {
          "not": {
            "required": [
              "release_channel_snapshot"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "stage": {
              "const": "approval_fingerprint"
            }
          },
          "required": [
            "stage"
          ]
        },
        "then": {
          "required": [
            "gate",
            "decision_source"
          ]
        },
        "else": {
          "not": {
            "anyOf": [
              {
                "required": [
                  "gate"
                ]
              },
              {
                "required": [
                  "decision_source"
                ]
              }
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "stage": {
              "const": "launch"
            }
          },
          "required": [
            "stage"
          ]
        },
        "then": {
          "required": [
            "logical_operation_id",
            "workflow_id"
          ],
          "not": {
            "required": [
              "original_workflow_id"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "stage": {
              "const": "recovery"
            }
          },
          "required": [
            "stage"
          ]
        },
        "then": {
          "required": [
            "logical_operation_id",
            "workflow_id",
            "original_workflow_id"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "stage": {
              "enum": [
                "estimate",
                "approval_fingerprint"
              ]
            }
          },
          "required": [
            "stage"
          ]
        },
        "then": {
          "not": {
            "anyOf": [
              {
                "required": [
                  "logical_operation_id"
                ]
              },
              {
                "required": [
                  "workflow_id"
                ]
              },
              {
                "required": [
                  "original_workflow_id"
                ]
              }
            ]
          }
        }
      }
    ]
  }
} as const;

export const DOCUMENT_TYPES = ["execution-pin-package", "execution-pin-stage"] as const;
export type DocumentType = "execution-pin-package" | "execution-pin-stage";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "execution-pin-package": [
    "1"
  ],
  "execution-pin-stage": [
    "1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type ExecutionPinPackage = {
    readonly "schema_version": "1";
    readonly "node_impl_pins": Record<string, unknown>;
    readonly "execution_dsl_hash": string;
    readonly "pin_fingerprint_hash": string;
    readonly "pinned_at": string;
    readonly "source_estimate_ref": {
    readonly "tenant_id": string;
    readonly "estimate_id": string;
  };
  };
export type ExecutionPinStage = {
    readonly "schema_version": "1";
    readonly "logical_execution_id": string;
    readonly "stage": "estimate" | "approval_fingerprint" | "launch" | "recovery" | "replan_required";
    readonly "gate"?: "g1" | "g2";
    readonly "decision_source"?: "human" | "policy";
    readonly "occurred_at": string;
    readonly "logical_operation_id"?: string;
    readonly "workflow_id"?: string;
    readonly "original_workflow_id"?: string;
    readonly "pin_package"?: unknown;
    readonly "release_channel_snapshot"?: Record<string, unknown>;
    readonly "mcp_metadata_revision"?: string | null;
    readonly "replan_reason"?: "node_impl_revision_unavailable" | "node_impl_pin_invalid";
  };

export const reader = new ContractPackageReader({
  package: "execution-pin",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
