// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/connector-policy/v1
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
  "eligibility-snapshot.schema.json": {
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

export const DOCUMENT_TYPES = ["eligibility-snapshot"] as const;
export type DocumentType = "eligibility-snapshot";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "eligibility-snapshot": [
    "connector_eligibility_snapshot_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "eligibility-snapshot": {
    "reason_code": [
      "approval_required",
      "budget_required",
      "capability_not_connector_owned",
      "connection_disabled",
      "feature_unavailable",
      "forbidden",
      "needs_connection",
      "plan_required",
      "rate_limited",
      "reauth_required",
      "resource_selection_required",
      "scope_required",
      "tool_policy_blocked",
      "tool_revision_changed",
      "unsupported_protocol",
      "upstream_unavailable",
      "version_conflict"
    ]
  }
};

export type EligibilitySnapshot = {
    readonly "schema_version": "connector_eligibility_snapshot_v1";
    readonly "capability_key": string;
    readonly "purpose": "readiness" | "dispatch";
    readonly "outcome": "callable" | "approval_required" | "not_callable";
    readonly "reason_code"?: "capability_not_connector_owned" | "feature_unavailable" | "plan_required" | "tool_policy_blocked" | "needs_connection" | "forbidden" | "reauth_required" | "connection_disabled" | "scope_required" | "resource_selection_required" | "tool_revision_changed" | "upstream_unavailable" | "rate_limited" | "unsupported_protocol" | "version_conflict" | "approval_required" | "budget_required";
    readonly "reason_codes": readonly ("capability_not_connector_owned" | "feature_unavailable" | "plan_required" | "tool_policy_blocked" | "needs_connection" | "forbidden" | "reauth_required" | "connection_disabled" | "scope_required" | "resource_selection_required" | "tool_revision_changed" | "upstream_unavailable" | "rate_limited" | "unsupported_protocol" | "version_conflict" | "approval_required" | "budget_required")[];
    readonly "card": "none" | "connect" | "enable" | "reconnect" | "add_permission" | "select_account" | "retry_later" | "review" | "funding";
    readonly "candidate": (unknown) | (null);
    readonly "candidates_count": number;
    readonly "selection_required": boolean;
    readonly "observed": (unknown) | (null);
    readonly "evaluated_at": string;
    readonly "freshness_until": string;
    readonly "dispatch_authority": false;
    readonly "permission"?: unknown;
  };

export const reader = new ContractPackageReader({
  package: "connector-policy",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
