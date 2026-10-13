// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/spend-envelope/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "spend-allocation.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/spend-envelope/v1/spend-allocation.schema.json",
    "title": "spend_allocation_v1",
    "description": "One atomic allocation of an envelope's ceiling to one attempt of one logical operation. The single charge owner (Assistant Chat reservation/settlement or Workflow node allocation/settlement) executes and settles it; its receipt is bound to this allocation exactly once. A new attempt gets a new allocation. Credit numbers must be compared as decimals.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "allocation_id",
      "envelope_id",
      "tenant_id",
      "logical_operation_id",
      "attempt",
      "idempotency_key",
      "charge_owner",
      "funding_channel",
      "principal_id",
      "quota_eligible",
      "authorization_phase",
      "approval_version",
      "effective_mode",
      "sub_job_ref",
      "allocated_credits",
      "quota_consumption",
      "status",
      "settled_credits",
      "overrun_credits",
      "release_evidence",
      "abandon",
      "receipt_binding",
      "created_at",
      "updated_at",
      "record_version"
    ],
    "properties": {
      "schema_version": {
        "const": 1
      },
      "allocation_id": {
        "type": "string",
        "pattern": "^alc_[A-Za-z0-9_-]{3,64}$"
      },
      "envelope_id": {
        "type": "string",
        "pattern": "^env_[A-Za-z0-9_-]{3,64}$"
      },
      "tenant_id": {
        "$ref": "#/$defs/OpaqueId"
      },
      "logical_operation_id": {
        "$ref": "#/$defs/OpaqueId"
      },
      "attempt": {
        "type": "integer",
        "minimum": 1,
        "maximum": 1000
      },
      "idempotency_key": {
        "type": "string",
        "minLength": 1,
        "maxLength": 256
      },
      "charge_owner": {
        "description": "The only execution charge owner for this allocation (URETIM 2B).",
        "enum": [
          "assistant",
          "workflow"
        ]
      },
      "funding_channel": {
        "enum": [
          "app",
          "api",
          "mcp"
        ]
      },
      "principal_id": {
        "$ref": "#/$defs/OpaqueId"
      },
      "quota_eligible": {
        "type": "boolean"
      },
      "authorization_phase": {
        "description": "Envelope phase the allocation was taken from (TK-17: sub-jobs use the parent's current phase).",
        "enum": [
          "preparation",
          "production",
          "session"
        ]
      },
      "approval_version": {
        "description": "Envelope approval_version when the allocation was granted; 0 only for quota-only allocations taken before any credit grant.",
        "type": "integer",
        "minimum": 0
      },
      "effective_mode": {
        "description": "P00-11 effective mode of the job at this dispatch (D04: a mode_snapshot grant derived under a higher mode waits for a new decision). null for schedule/triggered and API/MCP runs.",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "enum": [
              "ask",
              "auto",
              "auto_full"
            ]
          }
        ]
      },
      "sub_job_ref": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "sub_job_id",
              "parent_business_job_id"
            ],
            "properties": {
              "sub_job_id": {
                "$ref": "#/$defs/OpaqueId"
              },
              "parent_business_job_id": {
                "$ref": "#/$defs/OpaqueId"
              }
            }
          }
        ]
      },
      "allocated_credits": {
        "$ref": "#/$defs/Credits"
      },
      "quota_consumption": {
        "description": "Plan quota consumed alongside (or instead of) credits; only for quota-eligible app allocations (TK-15, Q82 split).",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "quota_key",
              "units"
            ],
            "properties": {
              "quota_key": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_:.-]{1,127}$"
              },
              "units": {
                "type": "number",
                "exclusiveMinimum": 0
              }
            }
          }
        ]
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
      "settled_credits": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "$ref": "#/$defs/Credits"
          }
        ]
      },
      "overrun_credits": {
        "description": "Actual cost above the allocation that could not be covered by remaining_allocatable; never charged, raises admin_review.",
        "$ref": "#/$defs/Credits"
      },
      "release_evidence": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "enum": [
              "provider_not_dispatched",
              "known_no_charge",
              "refund_completed"
            ]
          }
        ]
      },
      "abandon": {
        "description": "TK-16 class: a flow we cut on purpose is not outcome_unknown.",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "reason",
              "usage_reported"
            ],
            "properties": {
              "reason": {
                "enum": [
                  "user_cancel",
                  "lane_b_cancel",
                  "context_limit_summarize",
                  "supplier_switch"
                ]
              },
              "usage_reported": {
                "type": "boolean"
              }
            }
          }
        ]
      },
      "receipt_binding": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "receipt_kind",
              "receipt_id",
              "bound_at"
            ],
            "properties": {
              "receipt_kind": {
                "enum": [
                  "chat_usage_settlement",
                  "workflow_node_allocation"
                ]
              },
              "receipt_id": {
                "$ref": "#/$defs/OpaqueId"
              },
              "bound_at": {
                "$ref": "#/$defs/Timestamp"
              }
            }
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
            "quota_eligible": {
              "const": true
            }
          }
        },
        "else": {
          "properties": {
            "quota_eligible": {
              "const": false
            },
            "quota_consumption": {
              "type": "null"
            },
            "effective_mode": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "quota_consumption": {
              "type": "object"
            }
          },
          "required": [
            "quota_consumption"
          ]
        },
        "then": {
          "properties": {
            "quota_eligible": {
              "const": true
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "enum": [
                "authorized",
                "dispatched",
                "outcome_unknown"
              ]
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "settled_credits": {
              "type": "null"
            },
            "overrun_credits": {
              "maximum": 0
            },
            "release_evidence": {
              "type": "null"
            },
            "abandon": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "authorized"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "receipt_binding": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "settled"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "settled_credits": {
              "$ref": "#/$defs/Credits"
            },
            "release_evidence": {
              "type": "null"
            },
            "abandon": {
              "type": "null"
            },
            "receipt_binding": {
              "type": "object"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "abandoned"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "settled_credits": {
              "$ref": "#/$defs/Credits"
            },
            "release_evidence": {
              "type": "null"
            },
            "abandon": {
              "type": "object"
            },
            "receipt_binding": {
              "type": "object"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "released"
            }
          },
          "required": [
            "status"
          ]
        },
        "then": {
          "properties": {
            "settled_credits": {
              "$ref": "#/$defs/Credits",
              "maximum": 0
            },
            "overrun_credits": {
              "maximum": 0
            },
            "release_evidence": {
              "type": "string"
            },
            "abandon": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "charge_owner": {
              "const": "assistant"
            }
          },
          "required": [
            "charge_owner"
          ]
        },
        "then": {
          "properties": {
            "receipt_binding": {
              "properties": {
                "receipt_kind": {
                  "const": "chat_usage_settlement"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "charge_owner": {
              "const": "workflow"
            }
          },
          "required": [
            "charge_owner"
          ]
        },
        "then": {
          "properties": {
            "receipt_binding": {
              "properties": {
                "receipt_kind": {
                  "const": "workflow_node_allocation"
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
      "Timestamp": {
        "type": "string",
        "format": "date-time"
      },
      "Credits": {
        "description": "Credit amount on the existing Billing CreditAmount boundary (0.0001).",
        "type": "number",
        "minimum": 0,
        "maximum": 900719925474.0991,
        "multipleOf": 0.0001
      }
    }
  },
  "spend-envelope.schema.json": {
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

export const DOCUMENT_TYPES = ["spend-allocation", "spend-envelope"] as const;
export type DocumentType = "spend-allocation" | "spend-envelope";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "spend-allocation": [
    1
  ],
  "spend-envelope": [
    1
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "spend-allocation": {
    "status": [
      "abandoned",
      "authorized",
      "dispatched",
      "outcome_unknown",
      "released",
      "settled"
    ]
  },
  "spend-envelope": {
    "status": [
      "closed",
      "draining",
      "open"
    ]
  }
};

export type SpendAllocation = {
    readonly "schema_version": 1;
    readonly "allocation_id": string;
    readonly "envelope_id": string;
    readonly "tenant_id": string;
    readonly "logical_operation_id": string;
    readonly "attempt": number;
    readonly "idempotency_key": string;
    readonly "charge_owner": "assistant" | "workflow";
    readonly "funding_channel": "app" | "api" | "mcp";
    readonly "principal_id": string;
    readonly "quota_eligible": boolean;
    readonly "authorization_phase": "preparation" | "production" | "session";
    readonly "approval_version": number;
    readonly "effective_mode": (null) | ("ask" | "auto" | "auto_full");
    readonly "sub_job_ref": (null) | ({
    readonly "sub_job_id": string;
    readonly "parent_business_job_id": string;
  });
    readonly "allocated_credits": number;
    readonly "quota_consumption": (null) | ({
    readonly "quota_key": string;
    readonly "units": number;
  });
    readonly "status": "authorized" | "dispatched" | "outcome_unknown" | "settled" | "abandoned" | "released";
    readonly "settled_credits": (null) | (number);
    readonly "overrun_credits": number;
    readonly "release_evidence": (null) | ("provider_not_dispatched" | "known_no_charge" | "refund_completed");
    readonly "abandon": (null) | ({
    readonly "reason": "user_cancel" | "lane_b_cancel" | "context_limit_summarize" | "supplier_switch";
    readonly "usage_reported": boolean;
  });
    readonly "receipt_binding": (null) | ({
    readonly "receipt_kind": "chat_usage_settlement" | "workflow_node_allocation";
    readonly "receipt_id": string;
    readonly "bound_at": string;
  });
    readonly "created_at": string;
    readonly "updated_at": string;
    readonly "record_version": number;
  };
export type SpendEnvelope = {
    readonly "schema_version": 1;
    readonly "envelope_id": string;
    readonly "tenant_id": string;
    readonly "envelope_kind": "job" | "edit_session";
    readonly "subject": (unknown);
    readonly "funding_channel": "app" | "api" | "mcp";
    readonly "principal_id": string;
    readonly "principal_kind": "user" | "personal_key" | "developer_app" | "mcp_client";
    readonly "quota_eligible": boolean;
    readonly "launch_origin": "user_session" | "schedule" | "triggered" | "external_principal";
    readonly "status": "open" | "draining" | "closed";
    readonly "authorization_phase": "preparation" | "production" | "session";
    readonly "approval_version": number;
    readonly "approved_max_credits": number;
    readonly "spent": number;
    readonly "outstanding_authorized_allocations": number;
    readonly "outcome_unknown": number;
    readonly "remaining_allocatable": number;
    readonly "wallet_held": number;
    readonly "funding_buffer": number;
    readonly "authorization": (null) | (unknown);
    readonly "authorization_history": readonly (unknown)[];
    readonly "pending_approval_request": (null) | (unknown);
    readonly "created_at": string;
    readonly "updated_at": string;
    readonly "record_version": number;
  };

export const reader = new ContractPackageReader({
  package: "spend-envelope",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
