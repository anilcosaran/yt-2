// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/connector-invocation/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-invocation/v1/common.schema.json",
    "title": "connector_invocation_common_v1",
    "description": "Shared definitions for the P01C-11 connector-invocation package (invocation gateway). Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "CapabilityKey": {
        "description": "Connector capability exactly as the planner asked it (P01C-08 vocabulary, never normalized).",
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "ResourceRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "resource_kind",
          "resource_id"
        ],
        "properties": {
          "resource_kind": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
          },
          "resource_id": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$"
          }
        }
      },
      "Trigger": {
        "description": "Server-owned trigger. Only a Chat job step or a Workflow run node may invoke a connector tool; an OAuth connect, a webhook, a schedule or a browser message is never a trigger (P01C-11 'Connect olayi trigger degildir'; schedule/webhook triggers are P01C-23).",
        "oneOf": [
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "conversation_id",
              "job_id",
              "step_id"
            ],
            "properties": {
              "kind": {
                "const": "chat"
              },
              "conversation_id": {
                "$ref": "#/$defs/OpaqueId"
              },
              "job_id": {
                "$ref": "#/$defs/OpaqueId"
              },
              "step_id": {
                "$ref": "#/$defs/OpaqueId"
              }
            }
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "run_id",
              "node_id"
            ],
            "properties": {
              "kind": {
                "const": "workflow"
              },
              "run_id": {
                "$ref": "#/$defs/OpaqueId"
              },
              "node_id": {
                "$ref": "#/$defs/OpaqueId"
              },
              "workflow_revision_id": {
                "$ref": "#/$defs/OpaqueId"
              }
            }
          }
        ]
      },
      "Actor": {
        "description": "The human the job/run acts for. Set by the server-side caller from its own job/run record; never from a browser or an LLM.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "actor_id"
        ],
        "properties": {
          "kind": {
            "const": "user"
          },
          "actor_id": {
            "$ref": "#/$defs/OpaqueId"
          }
        }
      },
      "UntrustedToolResult": {
        "description": "P01C-12 connector_untrusted_content_v1 envelope around a provider tool result (P01C-25: tool output stays in the untrusted block). Data the model may read, never an instruction, approval, grant, capability, effect or budget: strings are sanitized (invisible/bidi/tag characters removed, chat role markers neutralized), size is bounded with explicit truncation, injection_signals are audit/eval/taint hints that never allow anything.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "schema_version",
          "trust",
          "origin",
          "content",
          "truncated",
          "injection_signals",
          "content_digest"
        ],
        "properties": {
          "schema_version": {
            "const": "connector_untrusted_content_v1"
          },
          "trust": {
            "const": "untrusted_data"
          },
          "origin": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind",
              "connection_id",
              "tool_revision_id"
            ],
            "properties": {
              "kind": {
                "const": "tool_result"
              },
              "connection_id": {
                "$ref": "#/$defs/OpaqueId"
              },
              "tool_revision_id": {
                "$ref": "#/$defs/OpaqueId"
              }
            }
          },
          "content": {},
          "truncated": {
            "type": "boolean"
          },
          "injection_signals": {
            "type": "array",
            "maxItems": 5,
            "uniqueItems": true,
            "items": {
              "enum": [
                "hidden_characters",
                "role_marker",
                "instruction_override",
                "secret_request",
                "exfiltration_request"
              ]
            }
          },
          "content_digest": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          }
        }
      },
      "ApprovalGate": {
        "description": "Assistant (P01-04, Q75) decision for this exact step: an external effect dispatches only when satisfied or not_required.",
        "enum": [
          "not_required",
          "satisfied",
          "required",
          "unknown"
        ]
      },
      "BudgetGate": {
        "description": "Billing (P00-10) funding decision: dispatch only when authorized or not_required.",
        "enum": [
          "not_required",
          "authorized",
          "required",
          "unknown"
        ]
      },
      "InvocationStatus": {
        "description": "Logical operation state. accepted, outcome_unknown, cancel_requested and cancel_confirmed stay distinct: an HTTP success is not terminal proof and a cancel request is not a confirmed cancel (CX14/CX15).",
        "enum": [
          "pending",
          "dispatched",
          "accepted",
          "outcome_unknown",
          "completed",
          "failed",
          "cancel_requested",
          "cancel_confirmed"
        ]
      },
      "CancelState": {
        "description": "none: no cancel asked. requested: asked, not confirmed by the provider. confirmed: the provider (or the gateway, before any dispatch) confirmed nothing ran. unknown: asked, but whether the operation ran is unknown.",
        "enum": [
          "none",
          "requested",
          "confirmed",
          "unknown"
        ]
      },
      "ReasonCode": {
        "description": "Safe reason vocabulary: connectors/MIMARI \u00a76 plus the P01C-10 eligibility codes that can stop a dispatch, and the gateway's own deterministic failures (deadline_exceeded, invalid_arguments, result_too_large).",
        "enum": [
          "capability_not_connector_owned",
          "feature_unavailable",
          "plan_required",
          "tool_policy_blocked",
          "needs_connection",
          "forbidden",
          "reauth_required",
          "connection_disabled",
          "scope_required",
          "resource_selection_required",
          "tool_revision_changed",
          "source_version_changed",
          "upstream_unavailable",
          "rate_limited",
          "unsupported_protocol",
          "version_conflict",
          "approval_required",
          "budget_required",
          "outcome_unknown",
          "deadline_exceeded",
          "invalid_arguments",
          "result_too_large"
        ]
      }
    }
  },
  "invocation-request.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-invocation/v1/invocation-request.schema.json",
    "title": "connector_invocation_request_v1",
    "description": "P01C-11 server-to-server invocation request (connectors/MIMARI \u00a72 ConnectorInvocationEnvelope input). Sent by a server-owned Chat job step or Workflow run node; the tenant comes from the caller's own record, never from this payload. The gateway re-evaluates the P01C-10 dispatch decision itself (the optional eligibility_snapshot is only fenced, never trusted), stores the arguments privately (args hash/ref on the invocation row) and answers with a connector_operation_v1. The same idempotency_key inside the same trigger + actor scope returns the same logical operation; a different payload under that key is idempotency_conflict.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "trigger",
      "actor",
      "capability_key",
      "connection_id",
      "resource",
      "args",
      "idempotency_key",
      "owner_gates"
    ],
    "properties": {
      "schema_version": {
        "const": "connector_invocation_request_v1"
      },
      "trigger": {
        "$ref": "common.schema.json#/$defs/Trigger"
      },
      "actor": {
        "$ref": "common.schema.json#/$defs/Actor"
      },
      "capability_key": {
        "$ref": "common.schema.json#/$defs/CapabilityKey"
      },
      "connection_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "resource": {
        "description": "Exactly one granted resource: a dispatch never picks an account or resource on its own.",
        "$ref": "common.schema.json#/$defs/ResourceRef"
      },
      "args": {
        "description": "Tool arguments. Bounded (64 KiB canonical JSON, depth 16) and validated by the tool executor; stored privately and never copied into an event, log or cache.",
        "type": "object",
        "maxProperties": 64
      },
      "idempotency_key": {
        "description": "Caller key, scoped by the gateway to trigger + actor. Retrying the same step with the same key is safe.",
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "expected_tool_revision_id": {
        "description": "Tool revision the user approved (Q75 'this account + tool revision'). A different current revision is tool_revision_changed; an old approval never carries over to a new revision.",
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "owner_gates": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "approval",
          "budget"
        ],
        "properties": {
          "approval": {
            "$ref": "common.schema.json#/$defs/ApprovalGate"
          },
          "budget": {
            "$ref": "common.schema.json#/$defs/BudgetGate"
          }
        }
      },
      "approval_ref": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "budget_envelope_ref": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "deadline_at": {
        "description": "Latest time a first dispatch may start. A queued operation past it fails with deadline_exceeded without being sent.",
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "eligibility_snapshot": {
        "description": "The planner's P01C-10 snapshot, if any. The gateway fences it against the current owner rows (version_conflict when anything moved) and never treats it as authority.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/connector-policy/v1/eligibility-snapshot.schema.json"
      }
    }
  },
  "operation.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-invocation/v1/operation.schema.json",
    "title": "connector_operation_v1",
    "description": "P01C-11 bounded view of one logical Connector operation (connectors/MIMARI \u00a72 OperationReceipt, aggregated over attempts). Always read from the Connector database receipts, never from a cache (P01C-19). Only the invoking actor or the owning job/run may read it. accepted, outcome_unknown, cancel_requested and cancel_confirmed are distinct: an HTTP success or a closed socket is not terminal proof, a cancel request is not a confirmed cancel, and a budget allocation may only be released once the operation is terminal and known (allocation_releasable).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "logical_operation_id",
      "trigger",
      "capability_key",
      "connection_id",
      "resource_refs",
      "tool_revision_id",
      "status",
      "cancel_state",
      "attempts",
      "needs_attention",
      "allocation_releasable",
      "result",
      "idempotent_replay",
      "created_at",
      "updated_at",
      "completed_at"
    ],
    "properties": {
      "schema_version": {
        "const": "connector_operation_v1"
      },
      "logical_operation_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "trigger": {
        "$ref": "common.schema.json#/$defs/Trigger"
      },
      "capability_key": {
        "$ref": "common.schema.json#/$defs/CapabilityKey"
      },
      "connection_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "resource_refs": {
        "type": "array",
        "minItems": 1,
        "maxItems": 1,
        "items": {
          "$ref": "common.schema.json#/$defs/ResourceRef"
        }
      },
      "tool_revision_id": {
        "$ref": "common.schema.json#/$defs/OpaqueId"
      },
      "status": {
        "$ref": "common.schema.json#/$defs/InvocationStatus"
      },
      "cancel_state": {
        "$ref": "common.schema.json#/$defs/CancelState"
      },
      "attempts": {
        "type": "integer",
        "minimum": 0,
        "maximum": 20
      },
      "reason_code": {
        "$ref": "common.schema.json#/$defs/ReasonCode"
      },
      "retry_after_seconds": {
        "type": "integer",
        "minimum": 0,
        "maximum": 3600
      },
      "needs_attention": {
        "description": "True when the outcome is unknown and no safe automatic recovery exists (no provider status/idempotency support, or the credential was revoked): the user/operator is told, nothing is resubmitted.",
        "type": "boolean"
      },
      "allocation_releasable": {
        "description": "True only for completed, failed and cancel_confirmed. A requested cancel, an accepted or an unknown operation keeps its budget allocation (CX15).",
        "type": "boolean"
      },
      "result": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Result"
          }
        ]
      },
      "idempotent_replay": {
        "description": "True when this answer is an existing operation returned for a repeated idempotency key.",
        "type": "boolean"
      },
      "created_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "updated_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "completed_at": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "common.schema.json#/$defs/Timestamp"
          }
        ]
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "status": {
              "const": "completed"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "result": {
              "$ref": "#/$defs/Result"
            },
            "allocation_releasable": {
              "const": true
            },
            "needs_attention": {
              "const": false
            },
            "cancel_state": {
              "enum": [
                "none",
                "requested"
              ]
            }
          },
          "not": {
            "required": [
              "reason_code"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "failed"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "result": {
              "type": "null"
            },
            "allocation_releasable": {
              "const": true
            },
            "reason_code": {
              "not": {
                "const": "outcome_unknown"
              }
            },
            "cancel_state": {
              "enum": [
                "none",
                "requested"
              ]
            }
          },
          "required": [
            "reason_code"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "cancel_confirmed"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "result": {
              "type": "null"
            },
            "cancel_state": {
              "const": "confirmed"
            },
            "allocation_releasable": {
              "const": true
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "outcome_unknown"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "result": {
              "type": "null"
            },
            "reason_code": {
              "const": "outcome_unknown"
            },
            "allocation_releasable": {
              "const": false
            },
            "cancel_state": {
              "enum": [
                "none",
                "unknown"
              ]
            }
          },
          "required": [
            "reason_code"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "enum": [
                "pending",
                "dispatched",
                "accepted"
              ]
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "result": {
              "type": "null"
            },
            "allocation_releasable": {
              "const": false
            },
            "cancel_state": {
              "const": "none"
            },
            "completed_at": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "cancel_requested"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "result": {
              "type": "null"
            },
            "allocation_releasable": {
              "const": false
            },
            "cancel_state": {
              "const": "requested"
            },
            "completed_at": {
              "type": "null"
            }
          }
        }
      }
    ],
    "$defs": {
      "Result": {
        "description": "Bounded tool result. Small outputs travel inline; larger ones only as a private ref the same audience reads back. Never cached in a shared cache (P01C-19).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "result_ref",
          "byte_size",
          "digest_sha256",
          "output_inline"
        ],
        "properties": {
          "result_ref": {
            "type": "string",
            "pattern": "^connector-result:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
          },
          "byte_size": {
            "type": "integer",
            "minimum": 0,
            "maximum": 131072
          },
          "digest_sha256": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "output_inline": {
            "type": "boolean"
          },
          "output": {
            "description": "The inline tool output inside the untrusted block (P01C-25). byte_size and digest_sha256 describe the stored canonical output; content_digest describes the sanitized content.",
            "$ref": "common.schema.json#/$defs/UntrustedToolResult"
          }
        },
        "if": {
          "properties": {
            "output_inline": {
              "const": true
            }
          },
          "required": [
            "output_inline"
          ]
        },
        "then": {
          "required": [
            "output"
          ],
          "properties": {
            "byte_size": {
              "maximum": 16384
            }
          }
        },
        "else": {
          "not": {
            "required": [
              "output"
            ]
          }
        }
      }
    }
  }
} as const;

// Foreign schema files reached through cross-package $refs, embedded verbatim
// from their owner package and registered next to SCHEMAS.
export const DEPENDENCY_SCHEMAS = {
  "connector-policy/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-policy/v1/common.schema.json",
    "title": "connector_policy_common_v1",
    "description": "Shared definitions for the P01C-10 connector-policy package (effective callable policy). Not a standalone document type.",
    "$defs": {
      "OpaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
      },
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Generation": {
        "description": "Owner generation observed at evaluation time (connection_revision, grant_epoch, grant_generation, resource_binding_revision, account version, definition/tool revision number). A dispatch compares it with the current owner row; any difference is version_conflict.",
        "type": "integer",
        "minimum": 0
      },
      "CapabilityKey": {
        "description": "Requested capability exactly as asked (never normalized). A malformed or internal key still gets a snapshot: capability_not_connector_owned.",
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "Purpose": {
        "description": "readiness: planner/UI projection (any callable path; owner gates are not evaluated, selection may stay open). dispatch: the exact candidate at dispatch time, owner gates (Ask/Auto approval, budget) intersected.",
        "enum": [
          "readiness",
          "dispatch"
        ]
      },
      "EligibilityOutcome": {
        "enum": [
          "callable",
          "approval_required",
          "not_callable"
        ]
      },
      "EligibilityReasonCode": {
        "description": "Versioned eligibility dictionary shared by TS, UI and Python (K185). reason-codes.json holds each code's card, precedence and tool_result mapping.",
        "enum": [
          "capability_not_connector_owned",
          "feature_unavailable",
          "plan_required",
          "tool_policy_blocked",
          "needs_connection",
          "forbidden",
          "reauth_required",
          "connection_disabled",
          "scope_required",
          "resource_selection_required",
          "tool_revision_changed",
          "upstream_unavailable",
          "rate_limited",
          "unsupported_protocol",
          "version_conflict",
          "approval_required",
          "budget_required"
        ]
      },
      "EligibilityCard": {
        "description": "Minimal Chat card for the primary reason. Only connect/reconnect/add_permission open an OAuth flow; enable/select_account stay inside Youtorch; none explains without a fake connect button.",
        "enum": [
          "none",
          "connect",
          "enable",
          "reconnect",
          "add_permission",
          "select_account",
          "retry_later",
          "review",
          "funding"
        ]
      },
      "Effect": {
        "enum": [
          "read",
          "write",
          "send",
          "publish",
          "delete",
          "media_generate",
          "spend",
          "admin"
        ]
      },
      "RiskLevel": {
        "enum": [
          "low",
          "medium",
          "high"
        ]
      },
      "ResourceRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "resource_kind",
          "resource_id"
        ],
        "properties": {
          "resource_kind": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
          },
          "resource_id": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$"
          }
        }
      }
    }
  },
  "connector-policy/v1/eligibility-snapshot.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/connector-policy/v1/eligibility-snapshot.schema.json",
    "title": "connector_eligibility_snapshot_v1",
    "description": "P01C-10 effective callable decision for one capability and one actor (connectors/MIMARI \u00a72 EligibilitySnapshot): the intersection of platform/feature/plan, tool policy, actor grant and connection revision, exact account/resource, approved head tool revision, health and \u2014 for purpose=dispatch \u2014 the owner gates (Ask/Auto approval from Assistant P01-04, budget from Billing P00-10). Routing/UX only: it is never dispatch authority; a dispatch re-evaluates against the current owner rows and compares `observed`. The card follows the primary reason: a health outage is retry_later (never reconnect), an internal or unknown capability is none (never an OAuth card).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "capability_key",
      "purpose",
      "outcome",
      "reason_codes",
      "card",
      "candidate",
      "candidates_count",
      "selection_required",
      "observed",
      "evaluated_at",
      "freshness_until",
      "dispatch_authority"
    ],
    "properties": {
      "schema_version": {
        "const": "connector_eligibility_snapshot_v1"
      },
      "capability_key": {
        "$ref": "common.schema.json#/$defs/CapabilityKey"
      },
      "purpose": {
        "$ref": "common.schema.json#/$defs/Purpose"
      },
      "outcome": {
        "$ref": "common.schema.json#/$defs/EligibilityOutcome"
      },
      "reason_code": {
        "description": "Primary reason: a capability-level reason, else the reason of the candidate closest to callable (reason-codes.json fixability_rank). Absent exactly when outcome=callable.",
        "$ref": "common.schema.json#/$defs/EligibilityReasonCode"
      },
      "reason_codes": {
        "description": "Every distinct reason seen across the evaluated candidates, in reason-codes.json precedence order.",
        "type": "array",
        "maxItems": 17,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/EligibilityReasonCode"
        }
      },
      "card": {
        "$ref": "common.schema.json#/$defs/EligibilityCard"
      },
      "candidate": {
        "description": "The callable candidate, or the candidate closest to callable (lowest fixability rank). Opaque ids only: no token, label, email or remote URL.",
        "oneOf": [
          {
            "$ref": "#/$defs/Candidate"
          },
          {
            "type": "null"
          }
        ]
      },
      "candidates_count": {
        "type": "integer",
        "minimum": 0,
        "maximum": 1000
      },
      "selection_required": {
        "description": "readiness: more than one callable connection/resource exists and none was selected (the dispatch will ask). Always false for dispatch (an open selection is resource_selection_required there).",
        "type": "boolean"
      },
      "observed": {
        "oneOf": [
          {
            "$ref": "#/$defs/ObservedGenerations"
          },
          {
            "type": "null"
          }
        ]
      },
      "evaluated_at": {
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "freshness_until": {
        "description": "End of the routing/UX validity window; after it the caller re-evaluates. Never extends an authority.",
        "$ref": "common.schema.json#/$defs/Timestamp"
      },
      "dispatch_authority": {
        "const": false
      },
      "permission": {
        "description": "P01C-25, purpose=dispatch only: how the approval gate of the chosen candidate was answered \u2014 the effect-class rule (read allow, write/send ask with an optional standing permission for this account + tool revision, publish/delete/spend/media_generate/admin always ask), the standing permission that answered it, or the taint rule (private connector data read in the same conversation/run makes a write/send/spend to another connection ask even in auto_full).",
        "$ref": "#/$defs/Permission"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "purpose": {
              "const": "readiness"
            }
          },
          "required": [
            "purpose"
          ]
        },
        "then": {
          "not": {
            "required": [
              "permission"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "outcome": {
              "const": "not_callable"
            }
          },
          "required": [
            "outcome"
          ]
        },
        "then": {
          "not": {
            "required": [
              "permission"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "outcome": {
              "const": "callable"
            }
          },
          "required": [
            "outcome"
          ]
        },
        "then": {
          "properties": {
            "reason_codes": {
              "maxItems": 0
            },
            "card": {
              "const": "none"
            },
            "candidate": {
              "$ref": "#/$defs/Candidate"
            },
            "candidates_count": {
              "minimum": 1
            },
            "observed": {
              "$ref": "#/$defs/ObservedGenerations"
            }
          },
          "not": {
            "required": [
              "reason_code"
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "outcome": {
              "const": "approval_required"
            }
          },
          "required": [
            "outcome"
          ]
        },
        "then": {
          "properties": {
            "purpose": {
              "const": "dispatch"
            },
            "reason_code": {
              "enum": [
                "budget_required",
                "approval_required"
              ]
            },
            "reason_codes": {
              "minItems": 1
            },
            "candidate": {
              "$ref": "#/$defs/Candidate"
            },
            "candidates_count": {
              "minimum": 1
            },
            "selection_required": {
              "const": false
            },
            "observed": {
              "$ref": "#/$defs/ObservedGenerations"
            }
          },
          "required": [
            "reason_code"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "outcome": {
              "const": "not_callable"
            }
          },
          "required": [
            "outcome"
          ]
        },
        "then": {
          "properties": {
            "reason_code": {
              "not": {
                "enum": [
                  "approval_required",
                  "budget_required"
                ]
              }
            },
            "reason_codes": {
              "minItems": 1
            }
          },
          "required": [
            "reason_code"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "purpose": {
              "const": "dispatch"
            }
          },
          "required": [
            "purpose"
          ]
        },
        "then": {
          "properties": {
            "selection_required": {
              "const": false
            }
          }
        }
      },
      {
        "$ref": "#/$defs/CardForReason"
      }
    ],
    "$defs": {
      "Permission": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "effect_rule",
          "basis",
          "always_allow_offer",
          "taint"
        ],
        "properties": {
          "effect_rule": {
            "description": "MCP \u00a78 effect-class persistent permission: read allow; write/send ask (a standing permission may answer); publish/delete/spend/media_generate/admin always ask.",
            "enum": [
              "allow",
              "ask",
              "always_ask"
            ]
          },
          "basis": {
            "description": "no_external_effect: nothing to approve. owner_gate: the Assistant's Ask/Auto gate decided. standing_permission: the actor's valid 'always allow for this account + tool revision' answered a required gate. taint: private data was read through another connection in this conversation/run, so only this step's explicit approval counts.",
            "enum": [
              "no_external_effect",
              "owner_gate",
              "standing_permission",
              "taint"
            ]
          },
          "standing_permission_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "always_allow_offer": {
            "description": "The Review card may offer 'always allow for this account + tool revision' (write/send and not tainted).",
            "type": "boolean"
          },
          "taint": {
            "enum": [
              "clear",
              "tainted",
              "not_evaluated"
            ]
          },
          "taint_source_count": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "standing_permission"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "required": [
                "standing_permission_id"
              ],
              "properties": {
                "effect_rule": {
                  "const": "ask"
                }
              }
            },
            "else": {
              "not": {
                "required": [
                  "standing_permission_id"
                ]
              }
            }
          },
          {
            "if": {
              "properties": {
                "basis": {
                  "const": "taint"
                }
              },
              "required": [
                "basis"
              ]
            },
            "then": {
              "properties": {
                "taint": {
                  "const": "tainted"
                }
              },
              "required": [
                "taint_source_count"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "taint": {
                  "const": "tainted"
                }
              },
              "required": [
                "taint"
              ]
            },
            "then": {
              "required": [
                "taint_source_count"
              ],
              "properties": {
                "always_allow_offer": {
                  "const": false
                },
                "basis": {
                  "enum": [
                    "taint",
                    "no_external_effect"
                  ]
                }
              }
            },
            "else": {
              "not": {
                "required": [
                  "taint_source_count"
                ]
              }
            }
          },
          {
            "if": {
              "properties": {
                "effect_rule": {
                  "enum": [
                    "allow",
                    "always_ask"
                  ]
                }
              },
              "required": [
                "effect_rule"
              ]
            },
            "then": {
              "properties": {
                "always_allow_offer": {
                  "const": false
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "effect_rule": {
                  "const": "allow"
                }
              },
              "required": [
                "effect_rule"
              ]
            },
            "then": {
              "properties": {
                "basis": {
                  "const": "no_external_effect"
                }
              }
            }
          }
        ]
      },
      "Candidate": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "connection_id",
          "definition_id",
          "tool_revision_id",
          "tool_name",
          "resource_refs",
          "effect",
          "risk_level",
          "external_effect",
          "always_allow_eligible"
        ],
        "properties": {
          "connection_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "definition_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_name": {
            "type": "string",
            "pattern": "^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$"
          },
          "resource_refs": {
            "type": "array",
            "maxItems": 100,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/ResourceRef"
            }
          },
          "effect": {
            "$ref": "common.schema.json#/$defs/Effect"
          },
          "risk_level": {
            "$ref": "common.schema.json#/$defs/RiskLevel"
          },
          "external_effect": {
            "type": "boolean"
          },
          "always_allow_eligible": {
            "type": "boolean"
          },
          "partner": {
            "description": "P01C-27 (Q63): present exactly for a media_generate candidate, which only a contracted partner registration can offer. billing_mode drives the plan line: youtorch_credits (Youtorch credits; Billing authorization required) or partner_account (charged to the user's partner account).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "contract_ref",
              "billing_mode"
            ],
            "properties": {
              "contract_ref": {
                "$ref": "common.schema.json#/$defs/OpaqueId"
              },
              "billing_mode": {
                "enum": [
                  "youtorch_credits",
                  "partner_account"
                ]
              }
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "effect": {
                  "const": "media_generate"
                }
              },
              "required": [
                "effect"
              ]
            },
            "then": {
              "required": [
                "partner"
              ]
            },
            "else": {
              "not": {
                "required": [
                  "partner"
                ]
              }
            }
          },
          {
            "if": {
              "properties": {
                "effect": {
                  "const": "read"
                }
              },
              "required": [
                "effect"
              ]
            },
            "then": {
              "properties": {
                "external_effect": {
                  "const": false
                },
                "always_allow_eligible": {
                  "const": false
                }
              }
            },
            "else": {
              "properties": {
                "external_effect": {
                  "const": true
                }
              }
            }
          },
          {
            "if": {
              "properties": {
                "effect": {
                  "enum": [
                    "publish",
                    "delete",
                    "media_generate",
                    "spend",
                    "admin"
                  ]
                }
              },
              "required": [
                "effect"
              ]
            },
            "then": {
              "properties": {
                "always_allow_eligible": {
                  "const": false
                }
              }
            }
          }
        ]
      },
      "ObservedGenerations": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "connection_revision",
          "grant_epoch",
          "grant_generation",
          "resource_binding_revision",
          "account_version",
          "definition_revision_number",
          "tool_revision_number"
        ],
        "properties": {
          "connection_revision": {
            "$ref": "common.schema.json#/$defs/Generation"
          },
          "grant_epoch": {
            "$ref": "common.schema.json#/$defs/Generation"
          },
          "grant_generation": {
            "description": "null when no grant covered the candidate (e.g. scope_required).",
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/Generation"
              },
              {
                "type": "null"
              }
            ]
          },
          "resource_binding_revision": {
            "$ref": "common.schema.json#/$defs/Generation"
          },
          "account_version": {
            "$ref": "common.schema.json#/$defs/Generation"
          },
          "definition_revision_number": {
            "$ref": "common.schema.json#/$defs/Generation"
          },
          "tool_revision_number": {
            "$ref": "common.schema.json#/$defs/Generation"
          }
        }
      },
      "CardForReason": {
        "description": "The minimal card is a function of the primary reason (reason-codes.json `card`). Schema-enforced so no reader can show a reconnect card for an outage or an OAuth card for an internal capability.",
        "allOf": [
          {
            "if": {
              "$ref": "#/$defs/ReasonNeedsConnection"
            },
            "then": {
              "properties": {
                "card": {
                  "const": "connect"
                }
              }
            }
          },
          {
            "if": {
              "$ref": "#/$defs/ReasonConnectionDisabled"
            },
            "then": {
              "properties": {
                "card": {
                  "const": "enable"
                }
              }
            }
          },
          {
            "if": {
              "$ref": "#/$defs/ReasonReauthRequired"
            },
            "then": {
              "properties": {
                "card": {
                  "const": "reconnect"
                }
              }
            }
          },
          {
            "if": {
              "$ref": "#/$defs/ReasonScopeRequired"
            },
            "then": {
              "properties": {
                "card": {
                  "const": "add_permission"
                }
              }
            }
          },
          {
            "if": {
              "$ref": "#/$defs/ReasonResourceSelectionRequired"
            },
            "then": {
              "properties": {
                "card": {
                  "const": "select_account"
                }
              }
            }
          },
          {
            "if": {
              "$ref": "#/$defs/ReasonRetryFamily"
            },
            "then": {
              "properties": {
                "card": {
                  "const": "retry_later"
                }
              }
            }
          },
          {
            "if": {
              "$ref": "#/$defs/ReasonApprovalRequired"
            },
            "then": {
              "properties": {
                "card": {
                  "const": "review"
                }
              }
            }
          },
          {
            "if": {
              "$ref": "#/$defs/ReasonBudgetRequired"
            },
            "then": {
              "properties": {
                "card": {
                  "const": "funding"
                }
              }
            }
          },
          {
            "if": {
              "$ref": "#/$defs/ReasonExplainOnly"
            },
            "then": {
              "properties": {
                "card": {
                  "const": "none"
                }
              }
            }
          }
        ]
      },
      "ReasonNeedsConnection": {
        "properties": {
          "reason_code": {
            "const": "needs_connection"
          }
        },
        "required": [
          "reason_code"
        ]
      },
      "ReasonConnectionDisabled": {
        "properties": {
          "reason_code": {
            "const": "connection_disabled"
          }
        },
        "required": [
          "reason_code"
        ]
      },
      "ReasonReauthRequired": {
        "properties": {
          "reason_code": {
            "const": "reauth_required"
          }
        },
        "required": [
          "reason_code"
        ]
      },
      "ReasonScopeRequired": {
        "properties": {
          "reason_code": {
            "const": "scope_required"
          }
        },
        "required": [
          "reason_code"
        ]
      },
      "ReasonResourceSelectionRequired": {
        "properties": {
          "reason_code": {
            "const": "resource_selection_required"
          }
        },
        "required": [
          "reason_code"
        ]
      },
      "ReasonRetryFamily": {
        "properties": {
          "reason_code": {
            "enum": [
              "upstream_unavailable",
              "rate_limited"
            ]
          }
        },
        "required": [
          "reason_code"
        ]
      },
      "ReasonApprovalRequired": {
        "properties": {
          "reason_code": {
            "const": "approval_required"
          }
        },
        "required": [
          "reason_code"
        ]
      },
      "ReasonBudgetRequired": {
        "properties": {
          "reason_code": {
            "const": "budget_required"
          }
        },
        "required": [
          "reason_code"
        ]
      },
      "ReasonExplainOnly": {
        "properties": {
          "reason_code": {
            "enum": [
              "capability_not_connector_owned",
              "feature_unavailable",
              "plan_required",
              "tool_policy_blocked",
              "forbidden",
              "tool_revision_changed",
              "unsupported_protocol",
              "version_conflict"
            ]
          }
        },
        "required": [
          "reason_code"
        ]
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["invocation-request", "operation"] as const;
export type DocumentType = "invocation-request" | "operation";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "invocation-request": [
    "connector_invocation_request_v1"
  ],
  "operation": [
    "connector_operation_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "operation": {
    "reason_code": [
      "approval_required",
      "budget_required",
      "capability_not_connector_owned",
      "connection_disabled",
      "deadline_exceeded",
      "feature_unavailable",
      "forbidden",
      "invalid_arguments",
      "needs_connection",
      "outcome_unknown",
      "plan_required",
      "rate_limited",
      "reauth_required",
      "resource_selection_required",
      "result_too_large",
      "scope_required",
      "source_version_changed",
      "tool_policy_blocked",
      "tool_revision_changed",
      "unsupported_protocol",
      "upstream_unavailable",
      "version_conflict"
    ],
    "status": [
      "accepted",
      "cancel_confirmed",
      "cancel_requested",
      "completed",
      "dispatched",
      "failed",
      "outcome_unknown",
      "pending"
    ]
  }
};

export type InvocationRequest = {
    readonly "schema_version": "connector_invocation_request_v1";
    readonly "trigger": unknown;
    readonly "actor": unknown;
    readonly "capability_key": string;
    readonly "connection_id": string;
    readonly "resource": unknown;
    readonly "args": Record<string, unknown>;
    readonly "idempotency_key": string;
    readonly "expected_tool_revision_id"?: string;
    readonly "owner_gates": {
    readonly "approval": "not_required" | "satisfied" | "required" | "unknown";
    readonly "budget": "not_required" | "authorized" | "required" | "unknown";
  };
    readonly "approval_ref"?: string;
    readonly "budget_envelope_ref"?: string;
    readonly "deadline_at"?: string;
    readonly "eligibility_snapshot"?: unknown;
  };
export type Operation = {
    readonly "schema_version": "connector_operation_v1";
    readonly "logical_operation_id": string;
    readonly "trigger": unknown;
    readonly "capability_key": string;
    readonly "connection_id": string;
    readonly "resource_refs": readonly (unknown)[];
    readonly "tool_revision_id": string;
    readonly "status": "pending" | "dispatched" | "accepted" | "outcome_unknown" | "completed" | "failed" | "cancel_requested" | "cancel_confirmed";
    readonly "cancel_state": "none" | "requested" | "confirmed" | "unknown";
    readonly "attempts": number;
    readonly "reason_code"?: "capability_not_connector_owned" | "feature_unavailable" | "plan_required" | "tool_policy_blocked" | "needs_connection" | "forbidden" | "reauth_required" | "connection_disabled" | "scope_required" | "resource_selection_required" | "tool_revision_changed" | "source_version_changed" | "upstream_unavailable" | "rate_limited" | "unsupported_protocol" | "version_conflict" | "approval_required" | "budget_required" | "outcome_unknown" | "deadline_exceeded" | "invalid_arguments" | "result_too_large";
    readonly "retry_after_seconds"?: number;
    readonly "needs_attention": boolean;
    readonly "allocation_releasable": boolean;
    readonly "result": (null) | (unknown);
    readonly "idempotent_replay": boolean;
    readonly "created_at": string;
    readonly "updated_at": string;
    readonly "completed_at": (null) | (string);
  };

export const reader = new ContractPackageReader({
  package: "connector-invocation",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
