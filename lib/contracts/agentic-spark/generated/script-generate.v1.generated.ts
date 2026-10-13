// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/script-generate/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "script-draft-result.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/script-generate/v1/script-draft-result.schema.json",
    "title": "script_draft_result_v1",
    "description": "Result of the canonical script writer node script_generate@1 (KARAR-VIDEO-BRIEF-SCRIPT-PLAN-VE-ONAY \u00a73A/\u00a73B, P04-18). The node writes with the brief/evidence/base script it was pinned to and returns the WHOLE script body (script_artifact_v1): an outline, a full script, or the pinned base with one chapter written or revised (deterministically merged, stable chapter/beat ids kept). body_digest_sha256 is the canonical sha256 of `script`. The node never writes a store: the owner commit (Composition ScriptArtifact revision, CAS on base_script_ref) happens in the Assistant completion adapter. A captured output that failed validation is returned with validation.status=invalid and no script (charged once, never re-inferred).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "node_type",
      "mode",
      "scope",
      "result_kind",
      "validation",
      "writer"
    ],
    "properties": {
      "schema_version": {
        "const": "script_draft_result_v1"
      },
      "node_type": {
        "const": "script_generate@1"
      },
      "mode": {
        "description": "outline: structure only (never a full script, K210); write: narration of the whole script or of one chapter; revise: a targeted change of the pinned base script.",
        "enum": [
          "outline",
          "write",
          "revise"
        ]
      },
      "scope": {
        "enum": [
          "whole_script",
          "chapter"
        ]
      },
      "result_kind": {
        "description": "Equals script.result_kind: full only when every enabled chapter has narration for every beat.",
        "enum": [
          "outline",
          "full"
        ]
      },
      "chapter_id": {
        "description": "The chapter a chapter-scope write/revise changed (the rest of the pinned base is unchanged).",
        "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/StableId"
      },
      "script": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/script-artifact.schema.json"
      },
      "body_digest_sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "brief_ref": {
        "description": "The exact recorded brief revision the node was pinned to (every write of a video preparation job). Absent only for a standalone/Canvas write from an unrecorded brief; such a result is never committed to a job's package.",
        "$ref": "#/$defs/BriefRef"
      },
      "research_ref": {
        "$ref": "#/$defs/ResearchRef"
      },
      "base_script_ref": {
        "description": "The exact script revision the node was pinned to (revise, chapter write, whole rewrite of an existing script). The owner commit is a CAS on it; a moved head makes the result stale.",
        "$ref": "#/$defs/ScriptRef"
      },
      "stats": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "chapters",
          "beats",
          "beats_with_narration",
          "word_count",
          "estimated_seconds"
        ],
        "properties": {
          "chapters": {
            "type": "integer",
            "minimum": 0,
            "maximum": 60
          },
          "beats": {
            "type": "integer",
            "minimum": 0,
            "maximum": 12000
          },
          "beats_with_narration": {
            "type": "integer",
            "minimum": 0,
            "maximum": 12000
          },
          "word_count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 200000
          },
          "estimated_seconds": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/Seconds"
          }
        }
      },
      "needs_evidence": {
        "description": "Statements the writer could not support with the pinned evidence (it never researches by itself, KARAR \u00a73A). Plain notes, bounded.",
        "type": "array",
        "maxItems": 20,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "note"
          ],
          "properties": {
            "beat_id": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/StableId"
            },
            "note": {
              "type": "string",
              "minLength": 1,
              "maxLength": 500
            }
          }
        }
      },
      "validation": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "status",
          "issues"
        ],
        "properties": {
          "status": {
            "enum": [
              "valid",
              "invalid"
            ]
          },
          "issues": {
            "type": "array",
            "maxItems": 50,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "code",
                "severity",
                "path"
              ],
              "properties": {
                "code": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_]{0,63}$"
                },
                "severity": {
                  "enum": [
                    "error",
                    "warning"
                  ]
                },
                "path": {
                  "type": "string",
                  "maxLength": 256
                }
              }
            }
          }
        }
      },
      "writer": {
        "description": "The exact writer execution (public model id and node implementation revision); provider usage/receipt stays in the internal financial path.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "impl_revision"
        ],
        "properties": {
          "model_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/ModelId"
          },
          "impl_revision": {
            "type": "integer",
            "minimum": 1
          },
          "output_tokens_limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 32000
          },
          "truncated": {
            "type": "boolean"
          }
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "validation": {
              "properties": {
                "status": {
                  "const": "valid"
                }
              }
            }
          }
        },
        "then": {
          "required": [
            "script",
            "body_digest_sha256",
            "stats"
          ]
        },
        "else": {
          "not": {
            "anyOf": [
              {
                "required": [
                  "script"
                ]
              },
              {
                "required": [
                  "body_digest_sha256"
                ]
              }
            ]
          }
        }
      },
      {
        "if": {
          "properties": {
            "scope": {
              "const": "chapter"
            }
          }
        },
        "then": {
          "required": [
            "chapter_id",
            "base_script_ref"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "mode": {
              "const": "revise"
            }
          }
        },
        "then": {
          "required": [
            "base_script_ref"
          ]
        }
      },
      {
        "if": {
          "properties": {
            "mode": {
              "const": "outline"
            }
          }
        },
        "then": {
          "properties": {
            "result_kind": {
              "const": "outline"
            },
            "scope": {
              "const": "whole_script"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "result_kind": {
              "const": "full"
            }
          }
        },
        "then": {
          "properties": {
            "script": {
              "properties": {
                "result_kind": {
                  "const": "full"
                }
              }
            }
          }
        },
        "else": {
          "properties": {
            "script": {
              "properties": {
                "result_kind": {
                  "const": "outline"
                }
              }
            }
          }
        }
      }
    ],
    "$defs": {
      "BriefRef": {
        "allOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "video_brief"
              }
            }
          }
        ]
      },
      "ResearchRef": {
        "allOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "research_pack"
              }
            }
          }
        ]
      },
      "ScriptRef": {
        "allOf": [
          {
            "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "script"
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
  "video-preparation/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json",
    "title": "video_preparation_common_v1",
    "description": "Shared definitions of the video-preparation v1 package (P04-15 schema part). Not a standalone document type. Ids, hashes, revisions and project ids are owned by assistant-runtime v1 and referenced, never copied.",
    "$defs": {
      "ArtifactKind": {
        "description": "Typed preparation artifact kinds (KARAR-VIDEO-BRIEF-SCRIPT-PLAN-VE-ONAY \u00a74). research_pack is P04-15's addition next to the P00-04 PreparationArtifactRef kinds.",
        "enum": [
          "video_brief",
          "research_pack",
          "script",
          "shot_plan",
          "production_plan"
        ]
      },
      "ArtifactId": {
        "description": "Composition-owned preparation artifact id.",
        "type": "string",
        "pattern": "^vprep_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
      },
      "ArtifactRevisionRef": {
        "description": "Exact immutable revision of one preparation artifact. The digest is the canonical sha256 of the stored body; a ref whose digest does not match the owner's revision is stale.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "artifact_kind",
          "artifact_id",
          "artifact_revision",
          "content_digest_sha256"
        ],
        "properties": {
          "artifact_kind": {
            "$ref": "#/$defs/ArtifactKind"
          },
          "artifact_id": {
            "$ref": "#/$defs/ArtifactId"
          },
          "artifact_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          "content_digest_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "StableId": {
        "description": "Stable chapter/beat/shot/source/claim id; unique inside its artifact, kept across revisions (execution, timeline narration bindings and progress refs use it).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_-]{0,63}$"
      },
      "Seconds": {
        "description": "Duration in seconds (planned/estimated before TTS, measured after).",
        "type": "number",
        "minimum": 0,
        "maximum": 36000
      },
      "Locale": {
        "type": "string",
        "pattern": "^[a-z]{2,3}(-[A-Z]{2})?$"
      },
      "AspectRatio": {
        "description": "Same set as the Composition project aspect ratio (#294).",
        "enum": [
          "16:9",
          "9:16",
          "1:1"
        ]
      },
      "Credits": {
        "description": "Credit amount (P00-10 precision 0.0001).",
        "type": "number",
        "minimum": 0,
        "multipleOf": 0.0001
      },
      "SectionRole": {
        "description": "Template structure role (KARAR 8C): intro/hook, main chapters, outro/CTA.",
        "enum": [
          "intro",
          "main",
          "outro",
          "cta"
        ]
      },
      "OwnerResourceRef": {
        "description": "Typed owner resource ref used by bindings (avatar/voice/template/element/kit/asset). No universal revision_id: the owner names its own revision.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "resource_kind",
          "resource_id"
        ],
        "properties": {
          "owner_bc": {
            "enum": [
              "avatar",
              "voice",
              "brand",
              "storage",
              "composition",
              "media_catalog"
            ]
          },
          "resource_kind": {
            "description": "P04-19 (additive v1 note R12-4) adds `motion`: a Brand Motion library revision the director resolver pinned.",
            "enum": [
              "avatar",
              "voice",
              "template",
              "intro",
              "outro",
              "element",
              "kit",
              "asset",
              "stock_item",
              "motion"
            ]
          },
          "resource_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "resource_revision": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          }
        }
      },
      "CapabilityRef": {
        "description": "Real Workflow catalog node the shot or operation needs. A name that is not in the tenant's catalog fails the capability validator; nothing is inferred from a product name (K230).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "node_type",
          "capability"
        ],
        "properties": {
          "node_type": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(@[0-9]+)?$",
            "maxLength": 128
          },
          "capability": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/CapabilityKey"
          },
          "model_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/ModelId"
          }
        }
      },
      "SelectionSource": {
        "description": "Why a binding/value was chosen (KARAR \u00a72 step 1, 8B order).",
        "enum": [
          "explicit",
          "job_selection",
          "template",
          "channel_default",
          "personal_default",
          "product_default",
          "product_suggestion"
        ]
      },
      "Provenance": {
        "description": "How a revision came to be. attached_from is the F23 copy-on-attach source (exact immutable revision; never rewritten by a writer call).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "origin"
        ],
        "properties": {
          "origin": {
            "enum": [
              "agent",
              "user",
              "system",
              "import",
              "attach"
            ]
          },
          "job_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "step_id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_.:-]{0,127}$"
          },
          "node_result": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "node_type",
              "result_digest_sha256"
            ],
            "properties": {
              "node_type": {
                "type": "string",
                "maxLength": 128
              },
              "result_digest_sha256": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
              }
            }
          },
          "attached_from": {
            "$ref": "#/$defs/AttachSourceRef"
          },
          "change_summary": {
            "type": "string",
            "maxLength": 500
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "origin": {
                  "const": "attach"
                }
              }
            },
            "then": {
              "required": [
                "attached_from"
              ]
            },
            "else": {
              "not": {
                "required": [
                  "attached_from"
                ]
              }
            }
          }
        ]
      },
      "AttachSourceRef": {
        "description": "Exact source revision of an attached script (F23), or of the research pack the attached script cites (copied with it so its claim refs stay exact). owner_bc assistant = standalone script artifact store; composition = another project's artifact.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "owner_bc",
          "artifact_kind",
          "artifact_id",
          "artifact_revision",
          "content_digest_sha256"
        ],
        "properties": {
          "owner_bc": {
            "enum": [
              "assistant",
              "composition"
            ]
          },
          "artifact_kind": {
            "enum": [
              "script",
              "research_pack"
            ]
          },
          "artifact_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "artifact_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          },
          "content_digest_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "ValidatorName": {
        "description": "Server validators of the ready rule (\u00a74 Ready kural\u0131).",
        "enum": [
          "schema",
          "semantic",
          "coverage",
          "timing",
          "capability",
          "estimate"
        ]
      },
      "ValidationIssue": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "validator",
          "code",
          "severity",
          "path"
        ],
        "properties": {
          "validator": {
            "$ref": "#/$defs/ValidatorName"
          },
          "code": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
          },
          "severity": {
            "enum": [
              "error",
              "warning"
            ]
          },
          "path": {
            "type": "string",
            "maxLength": 256
          },
          "ref": {
            "type": "string",
            "maxLength": 128
          }
        }
      },
      "Readiness": {
        "description": "draft: saved, not offered for G1 (e.g. outline, estimate pending). not_ready: validation failed. ready: every validator passed. stale: derived at read time when a dependency head moved past the pinned ref.",
        "enum": [
          "draft",
          "not_ready",
          "ready",
          "stale"
        ]
      },
      "QualityTier": {
        "description": "P04-03 (additive v1 note): the Ekonomik/Dengeli/Kalite profile a generation was planned with (KARAR 8F). A label of the owner choice, never a claim that a model is measured best.",
        "enum": [
          "economy",
          "balanced",
          "quality"
        ]
      },
      "TransitionHandles": {
        "description": "P04-03 (additive v1 note): extra generated seconds before/after the usable window that a transition may use; never counted as timeline time.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "in_seconds",
          "out_seconds"
        ],
        "properties": {
          "in_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 10
          },
          "out_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 10
          }
        }
      },
      "NarratorTiming": {
        "description": "P04-03 (additive v1 note): where the shot's narration is spoken inside the shot, relative to the shot start. `estimated` before TTS (speech-rate basis); `measured` only after the real TTS/alignment (P04-07).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "start_seconds",
          "end_seconds",
          "basis"
        ],
        "properties": {
          "start_seconds": {
            "$ref": "#/$defs/Seconds"
          },
          "end_seconds": {
            "$ref": "#/$defs/Seconds"
          },
          "basis": {
            "enum": [
              "estimated",
              "measured"
            ]
          }
        }
      },
      "OperationId": {
        "description": "P04-15 compiler (additive v1 note): id of one compiled logical operation, sha256-derived from job + operation key + input hash (a changed input is a new operation; a recovery of the same operation keeps its id). Matches the P03-06 production operation id pattern.",
        "type": "string",
        "pattern": "^vop_[a-f0-9]{32}$"
      },
      "GeneratedTakeRef": {
        "description": "P04-03 (additive v1 note) F21 GeneratedTake identity: one result of one GenerationShot attempt. take_id = '<generation_shot_id>-t<attempt>' (preparation-rules.json derivation_rules). Produced by execution (P04-08); a new user take is a new attempt, a recovery of the same operation keeps its attempt.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "take_id",
          "generation_shot_id",
          "attempt"
        ],
        "properties": {
          "take_id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_-]{0,63}-t[0-9]{1,3}$"
          },
          "generation_shot_id": {
            "$ref": "#/$defs/StableId"
          },
          "attempt": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100
          },
          "operation_id": {
            "$ref": "#/$defs/OperationId"
          }
        }
      },
      "ClipInstanceTarget": {
        "description": "P04-03 (additive v1 note) F21 ClipInstance target: the plan scene and its typed layer that a take or a reused asset fills (materialized as a Composition clip layer through the P03-06 production binding).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "scene_id",
          "layer_key"
        ],
        "properties": {
          "scene_id": {
            "$ref": "#/$defs/StableId"
          },
          "layer_key": {
            "$ref": "#/$defs/StableId"
          }
        }
      }
    }
  },
  "video-preparation/v1/script-artifact.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/script-artifact.schema.json",
    "title": "script_artifact_v1",
    "description": "ScriptArtifact body (KARAR \u00a74, \u00a712A, 3B): stable chapter/beat ids, title/angle/hook options, purpose/key message/narrative flow, the FULL narration of every beat, estimated seconds/words and pauses, on-screen texts (quoted screen texts are bound to beats for Motion Film) and claim refs. result_kind=outline can never be ready (K210). A disabled optional chapter keeps its text but does not count toward narration/timing (8C).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "result_kind",
      "title",
      "language",
      "angle",
      "hook",
      "purpose",
      "key_message",
      "narrative_flow",
      "chapters",
      "totals"
    ],
    "properties": {
      "schema_version": {
        "const": "script_artifact_v1"
      },
      "result_kind": {
        "enum": [
          "full",
          "outline"
        ]
      },
      "narration_mode": {
        "description": "P04-20 (additive v1 note): `spoken` (the default when absent) = every beat of a full script carries the narration to be spoken. `none` = a screen-text film (the Motion Film default: no voice-over): a full script keeps every beat's narration empty and every beat carries at least one on-screen text instead; the copy is rendered exactly as quoted.",
        "enum": [
          "spoken",
          "none"
        ]
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "language": {
        "$ref": "common.schema.json#/$defs/Locale"
      },
      "angle": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "hook": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "options",
          "selected_hook_id"
        ],
        "properties": {
          "options": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "hook_id",
                "text"
              ],
              "properties": {
                "hook_id": {
                  "$ref": "common.schema.json#/$defs/StableId"
                },
                "text": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 1000
                }
              }
            }
          },
          "selected_hook_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          }
        }
      },
      "purpose": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "key_message": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "narrative_flow": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      },
      "brief_ref": {
        "$ref": "#/$defs/BriefRef"
      },
      "research_ref": {
        "$ref": "#/$defs/ResearchRef"
      },
      "chapters": {
        "type": "array",
        "minItems": 1,
        "maxItems": 60,
        "items": {
          "$ref": "#/$defs/Chapter"
        }
      },
      "totals": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "estimated_seconds",
          "word_count",
          "speech_rate_wpm",
          "rate_basis"
        ],
        "properties": {
          "estimated_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "word_count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 200000
          },
          "speech_rate_wpm": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 400
          },
          "rate_basis": {
            "description": "No fixed '10 min = X words' promise: the tempo is measured for the voice or an explicit assumption (\u00a77).",
            "enum": [
              "measured",
              "assumed"
            ]
          }
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "result_kind": {
              "const": "full"
            },
            "narration_mode": {
              "const": "none"
            }
          },
          "required": [
            "result_kind",
            "narration_mode"
          ]
        },
        "then": {
          "properties": {
            "chapters": {
              "items": {
                "properties": {
                  "beats": {
                    "items": {
                      "properties": {
                        "on_screen_texts": {
                          "minItems": 1
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "else": {
          "if": {
            "properties": {
              "result_kind": {
                "const": "full"
              }
            }
          },
          "then": {
            "properties": {
              "chapters": {
                "items": {
                  "properties": {
                    "beats": {
                      "items": {
                        "properties": {
                          "narration": {
                            "minLength": 1
                          }
                        }
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
      "BriefRef": {
        "allOf": [
          {
            "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "video_brief"
              }
            }
          }
        ]
      },
      "ResearchRef": {
        "allOf": [
          {
            "$ref": "common.schema.json#/$defs/ArtifactRevisionRef"
          },
          {
            "properties": {
              "artifact_kind": {
                "const": "research_pack"
              }
            }
          }
        ]
      },
      "Chapter": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "chapter_id",
          "title",
          "section_role",
          "enabled",
          "estimated_seconds",
          "beats"
        ],
        "properties": {
          "chapter_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "section_role": {
            "$ref": "common.schema.json#/$defs/SectionRole"
          },
          "enabled": {
            "type": "boolean"
          },
          "target_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "estimated_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "beats": {
            "type": "array",
            "minItems": 1,
            "maxItems": 200,
            "items": {
              "$ref": "#/$defs/Beat"
            }
          }
        }
      },
      "Beat": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "beat_id",
          "narration",
          "on_screen_texts",
          "claim_refs",
          "estimated_seconds",
          "word_count"
        ],
        "properties": {
          "beat_id": {
            "$ref": "common.schema.json#/$defs/StableId"
          },
          "narration": {
            "description": "The exact text to be spoken (full script). Empty only in an outline, or in a full script whose narration_mode is `none` (a screen-text film: the beat's on-screen texts carry the copy).",
            "type": "string",
            "maxLength": 20000
          },
          "summary": {
            "type": "string",
            "maxLength": 1000
          },
          "on_screen_texts": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "text_id",
                "text",
                "quoted"
              ],
              "properties": {
                "text_id": {
                  "$ref": "common.schema.json#/$defs/StableId"
                },
                "text": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 500
                },
                "quoted": {
                  "description": "Motion Film quoted screen text bound to this beat (P04-20).",
                  "type": "boolean"
                }
              }
            }
          },
          "claim_refs": {
            "type": "array",
            "maxItems": 20,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/StableId"
            }
          },
          "estimated_seconds": {
            "$ref": "common.schema.json#/$defs/Seconds"
          },
          "word_count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 5000
          },
          "pause_after_ms": {
            "type": "integer",
            "minimum": 0,
            "maximum": 10000
          }
        }
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["script-draft-result"] as const;
export type DocumentType = "script-draft-result";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "script-draft-result": [
    "script_draft_result_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type ScriptDraftResult = {
    readonly "schema_version": "script_draft_result_v1";
    readonly "node_type": "script_generate@1";
    readonly "mode": "outline" | "write" | "revise";
    readonly "scope": "whole_script" | "chapter";
    readonly "result_kind": "outline" | "full";
    readonly "chapter_id"?: unknown;
    readonly "script"?: unknown;
    readonly "body_digest_sha256"?: unknown;
    readonly "brief_ref"?: unknown;
    readonly "research_ref"?: unknown;
    readonly "base_script_ref"?: unknown;
    readonly "stats"?: {
    readonly "chapters": number;
    readonly "beats": number;
    readonly "beats_with_narration": number;
    readonly "word_count": number;
    readonly "estimated_seconds": unknown;
  };
    readonly "needs_evidence"?: readonly ({
    readonly "beat_id"?: unknown;
    readonly "note": string;
  })[];
    readonly "validation": {
    readonly "status": "valid" | "invalid";
    readonly "issues": readonly ({
    readonly "code": string;
    readonly "severity": "error" | "warning";
    readonly "path": string;
  })[];
  };
    readonly "writer": {
    readonly "model_id"?: unknown;
    readonly "impl_revision": number;
    readonly "output_tokens_limit"?: number;
    readonly "truncated"?: boolean;
  };
  };

export const reader = new ContractPackageReader({
  package: "script-generate",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
