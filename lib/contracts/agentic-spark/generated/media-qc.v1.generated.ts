// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/media-qc/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/media-qc/v1/common.schema.json",
    "title": "media_qc_common_v1",
    "description": "Shared definitions of the media-qc v1 package (P04-09 renderer/media QC profile and partial result). Not a standalone document type. Ids, hashes and timestamps are owned by assistant-runtime v1.",
    "$defs": {
      "ProfileId": {
        "type": "string",
        "pattern": "^[a-z0-9][a-z0-9.-]{1,63}$"
      },
      "ProfileRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "profile_id",
          "profile_revision"
        ],
        "properties": {
          "profile_id": {
            "$ref": "#/$defs/ProfileId"
          },
          "profile_revision": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "AspectRatio": {
        "enum": [
          "16:9",
          "9:16",
          "1:1"
        ]
      },
      "Rational": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "num",
          "den"
        ],
        "properties": {
          "num": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1000000
          },
          "den": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1000000
          }
        }
      },
      "FrameRange": {
        "description": "Output frame indices, start inclusive, end exclusive (integer frames of the profile frame clock).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "start_frame",
          "end_frame"
        ],
        "properties": {
          "start_frame": {
            "type": "integer",
            "minimum": 0
          },
          "end_frame": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "ArtifactRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
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
      "ScorerVerdict": {
        "description": "An identity/reference scorer never guarantees identity: pass, fail or uncertain only.",
        "enum": [
          "pass",
          "fail",
          "uncertain"
        ]
      },
      "CheckId": {
        "enum": [
          "decode",
          "frame_count",
          "frame_rate",
          "resolution",
          "audio",
          "black_frames",
          "sync",
          "identity"
        ]
      },
      "CheckResult": {
        "description": "review: the measurement asks for a person or a bounded repair (e.g. a black run outside the allowed ranges); not_measured: a required measurement is missing (never read as pass).",
        "enum": [
          "pass",
          "fail",
          "review",
          "not_measured",
          "not_applicable"
        ]
      }
    }
  },
  "media-qc-measurement.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/media-qc/v1/media-qc-measurement.schema.json",
    "title": "media_qc_measurement_v1",
    "description": "What one measurement run observed on one produced media artifact (decode, frames, rate, size, audio, black runs, sync, identity scorer). Facts only: the verdict is the owner's evaluation against a profile (media_qc_report_v1). A measurement that could not be made is 'measured: false' / null, never a guessed pass.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "artifact",
      "measured_at",
      "measurer",
      "decode",
      "video",
      "audio",
      "black_runs",
      "sync",
      "identity"
    ],
    "properties": {
      "schema_version": {
        "const": "media_qc_measurement_v1"
      },
      "artifact": {
        "$ref": "common.schema.json#/$defs/ArtifactRef"
      },
      "measured_at": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Timestamp"
      },
      "measurer": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "implementation_revision"
        ],
        "properties": {
          "implementation_revision": {
            "description": "Media primitive revision + FFmpeg build (toolchain implementation_revision).",
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "black_detect": {
            "description": "The blackdetect thresholds actually used (must equal the profile's).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "luma_max",
              "pixel_ratio_min",
              "min_consecutive_frames"
            ],
            "properties": {
              "luma_max": {
                "type": "number"
              },
              "pixel_ratio_min": {
                "type": "number"
              },
              "min_consecutive_frames": {
                "type": "integer",
                "minimum": 1
              }
            }
          }
        }
      },
      "decode": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "opened",
          "error"
        ],
        "properties": {
          "opened": {
            "type": "boolean"
          },
          "error": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "enum": [
                  "unreadable",
                  "truncated",
                  "no_video_stream",
                  "zero_frames",
                  "timeout"
                ]
              }
            ]
          }
        }
      },
      "video": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "frame_count",
              "frame_rate",
              "vfr",
              "width",
              "height",
              "duration_ms"
            ],
            "properties": {
              "frame_count": {
                "type": "integer",
                "minimum": 0
              },
              "frame_rate": {
                "$ref": "common.schema.json#/$defs/Rational"
              },
              "vfr": {
                "type": "boolean"
              },
              "width": {
                "type": "integer",
                "minimum": 1
              },
              "height": {
                "type": "integer",
                "minimum": 1
              },
              "duration_ms": {
                "type": "integer",
                "minimum": 0
              }
            }
          }
        ]
      },
      "audio": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "sample_rate_hz",
              "channels",
              "duration_ms"
            ],
            "properties": {
              "sample_rate_hz": {
                "type": "integer",
                "minimum": 1
              },
              "channels": {
                "type": "integer",
                "minimum": 1,
                "maximum": 16
              },
              "duration_ms": {
                "type": "integer",
                "minimum": 0
              }
            }
          }
        ]
      },
      "black_runs": {
        "description": "Runs of frames meeting the profile's black thresholds (normalized luma <= luma_max on >= pixel_ratio_min of the pixels) for at least min_consecutive_frames.",
        "type": "array",
        "maxItems": 200,
        "items": {
          "$ref": "common.schema.json#/$defs/FrameRange"
        }
      },
      "sync": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "measured"
        ],
        "properties": {
          "measured": {
            "type": "boolean"
          },
          "max_offset_frames": {
            "type": "integer",
            "minimum": 0
          }
        },
        "if": {
          "properties": {
            "measured": {
              "const": true
            }
          }
        },
        "then": {
          "required": [
            "max_offset_frames"
          ]
        }
      },
      "identity": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "measured"
        ],
        "properties": {
          "measured": {
            "type": "boolean"
          },
          "scorer_revision": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "calibration_profile_revision": {
            "description": "null: the scorer revision has no passing calibration profile (it can never auto-pass).",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "string",
                "minLength": 1,
                "maxLength": 128
              }
            ]
          },
          "verdict": {
            "$ref": "common.schema.json#/$defs/ScorerVerdict"
          }
        },
        "if": {
          "properties": {
            "measured": {
              "const": true
            }
          }
        },
        "then": {
          "required": [
            "scorer_revision",
            "calibration_profile_revision",
            "verdict"
          ]
        }
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "decode": {
              "properties": {
                "opened": {
                  "const": false
                }
              }
            }
          }
        },
        "then": {
          "properties": {
            "video": {
              "type": "null"
            },
            "black_runs": {
              "maxItems": 0
            }
          }
        }
      }
    ]
  },
  "media-qc-profile.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/media-qc/v1/media-qc-profile.schema.json",
    "title": "media_qc_profile_v1",
    "description": "A versioned renderer/media QC profile (KARAR-FRAME-EXTRACT-VE-SANDBOX 'Renderer ve medya QC kabul profili'). The values are frozen per profile revision: a change is a new revision with a reason and new full evidence, never a relaxed threshold after a result was seen. The canonical first profile is profiles/spark-media-qc-v1.json.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "profile_id",
      "profile_revision",
      "frame_rate",
      "resolutions",
      "color",
      "audio",
      "duration",
      "black_frames",
      "sync",
      "identity",
      "repair"
    ],
    "properties": {
      "schema_version": {
        "const": "media_qc_profile_v1"
      },
      "profile_id": {
        "$ref": "common.schema.json#/$defs/ProfileId"
      },
      "profile_revision": {
        "type": "integer",
        "minimum": 1
      },
      "frame_rate": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "num",
          "den",
          "mode"
        ],
        "properties": {
          "num": {
            "type": "integer",
            "minimum": 1
          },
          "den": {
            "type": "integer",
            "minimum": 1
          },
          "mode": {
            "const": "cfr"
          }
        }
      },
      "resolutions": {
        "description": "Allowed output sizes per aspect ratio.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "16:9",
          "9:16",
          "1:1"
        ],
        "properties": {
          "16:9": {
            "type": "array",
            "minItems": 1,
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
                  "minimum": 16
                },
                "height": {
                  "type": "integer",
                  "minimum": 16
                }
              }
            }
          },
          "9:16": {
            "type": "array",
            "minItems": 1,
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
                  "minimum": 16
                },
                "height": {
                  "type": "integer",
                  "minimum": 16
                }
              }
            }
          },
          "1:1": {
            "type": "array",
            "minItems": 1,
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
                  "minimum": 16
                },
                "height": {
                  "type": "integer",
                  "minimum": 16
                }
              }
            }
          }
        }
      },
      "color": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "transfer",
          "primaries"
        ],
        "properties": {
          "transfer": {
            "const": "sdr"
          },
          "primaries": {
            "const": "bt709"
          }
        }
      },
      "audio": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "sample_rate_hz"
        ],
        "properties": {
          "sample_rate_hz": {
            "type": "integer",
            "minimum": 8000
          }
        }
      },
      "duration": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "frame_count",
          "container_tolerance_frames"
        ],
        "properties": {
          "frame_count": {
            "description": "The decoded frame count equals the expected count exactly (no tolerance).",
            "const": "exact"
          },
          "container_tolerance_frames": {
            "type": "integer",
            "minimum": 0,
            "maximum": 2
          }
        }
      },
      "black_frames": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "luma_max",
          "pixel_ratio_min",
          "min_consecutive_frames",
          "on_detect"
        ],
        "properties": {
          "luma_max": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 1
          },
          "pixel_ratio_min": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 1
          },
          "min_consecutive_frames": {
            "type": "integer",
            "minimum": 1
          },
          "on_detect": {
            "description": "A black run outside the allowed ranges needs review/repair; a naturally dark scene is never an automatic definite failure.",
            "const": "review"
          }
        }
      },
      "sync": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "max_offset_frames"
        ],
        "properties": {
          "max_offset_frames": {
            "type": "integer",
            "minimum": 0,
            "maximum": 3
          }
        }
      },
      "identity": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "calibration",
          "auto_pass_requires_calibration"
        ],
        "properties": {
          "calibration": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "positives_min",
              "negatives_min",
              "false_accepts_max",
              "positive_recall_min"
            ],
            "properties": {
              "positives_min": {
                "type": "integer",
                "minimum": 1
              },
              "negatives_min": {
                "type": "integer",
                "minimum": 1
              },
              "false_accepts_max": {
                "type": "integer",
                "minimum": 0
              },
              "positive_recall_min": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 1
              }
            }
          },
          "auto_pass_requires_calibration": {
            "const": true
          }
        }
      },
      "repair": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "max_automatic_repairs_per_shot"
        ],
        "properties": {
          "max_automatic_repairs_per_shot": {
            "type": "integer",
            "minimum": 0,
            "maximum": 2
          }
        }
      }
    }
  },
  "media-qc-report.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/media-qc/v1/media-qc-report.schema.json",
    "title": "media_qc_report_v1",
    "description": "The owner's evaluation of one measured artifact against a versioned QC profile and the shot's expectation. A hard media failure (decode, frames, rate, size, required audio) is kept apart from the semantic verdict (black frames, sync, identity: pass/fail/uncertain). Only accept may be applied as the shot's take; repair regenerates only this shot (bounded); attention keeps the last good take and never claims success.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "profile",
      "artifact",
      "expectation",
      "checks",
      "hard_failure",
      "semantic_verdict",
      "decision"
    ],
    "properties": {
      "schema_version": {
        "const": "media_qc_report_v1"
      },
      "profile": {
        "$ref": "common.schema.json#/$defs/ProfileRef"
      },
      "artifact": {
        "$ref": "common.schema.json#/$defs/ArtifactRef"
      },
      "expectation": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "aspect_ratio",
          "frame_count",
          "audio_required",
          "allowed_black_ranges",
          "identity_required",
          "sync_required"
        ],
        "properties": {
          "aspect_ratio": {
            "$ref": "common.schema.json#/$defs/AspectRatio"
          },
          "frame_count": {
            "description": "Expected decoded frames at the profile rate; null when the shot's exact length is decided later (fit).",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "integer",
                "minimum": 1
              }
            ]
          },
          "audio_required": {
            "type": "boolean"
          },
          "allowed_black_ranges": {
            "description": "Manifest/plan black or fade ranges (a black run inside them is not a finding).",
            "type": "array",
            "maxItems": 50,
            "items": {
              "$ref": "common.schema.json#/$defs/FrameRange"
            }
          },
          "identity_required": {
            "type": "boolean"
          },
          "sync_required": {
            "type": "boolean"
          }
        }
      },
      "checks": {
        "type": "array",
        "minItems": 8,
        "maxItems": 8,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "check_id",
            "result"
          ],
          "properties": {
            "check_id": {
              "$ref": "common.schema.json#/$defs/CheckId"
            },
            "result": {
              "$ref": "common.schema.json#/$defs/CheckResult"
            },
            "detail": {
              "type": "string",
              "maxLength": 200
            }
          }
        }
      },
      "hard_failure": {
        "type": "boolean"
      },
      "semantic_verdict": {
        "$ref": "common.schema.json#/$defs/ScorerVerdict"
      },
      "decision": {
        "enum": [
          "accept",
          "repair",
          "attention"
        ]
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "decision": {
              "const": "accept"
            }
          }
        },
        "then": {
          "properties": {
            "hard_failure": {
              "const": false
            },
            "semantic_verdict": {
              "const": "pass"
            }
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

export const DOCUMENT_TYPES = ["media-qc-measurement", "media-qc-profile", "media-qc-report"] as const;
export type DocumentType = "media-qc-measurement" | "media-qc-profile" | "media-qc-report";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "media-qc-measurement": [
    "media_qc_measurement_v1"
  ],
  "media-qc-profile": [
    "media_qc_profile_v1"
  ],
  "media-qc-report": [
    "media_qc_report_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type MediaQcMeasurement = {
    readonly "schema_version": "media_qc_measurement_v1";
    readonly "artifact": unknown;
    readonly "measured_at": unknown;
    readonly "measurer": {
    readonly "implementation_revision": string;
    readonly "black_detect"?: {
    readonly "luma_max": number;
    readonly "pixel_ratio_min": number;
    readonly "min_consecutive_frames": number;
  };
  };
    readonly "decode": {
    readonly "opened": boolean;
    readonly "error": (null) | ("unreadable" | "truncated" | "no_video_stream" | "zero_frames" | "timeout");
  };
    readonly "video": (null) | ({
    readonly "frame_count": number;
    readonly "frame_rate": unknown;
    readonly "vfr": boolean;
    readonly "width": number;
    readonly "height": number;
    readonly "duration_ms": number;
  });
    readonly "audio": (null) | ({
    readonly "sample_rate_hz": number;
    readonly "channels": number;
    readonly "duration_ms": number;
  });
    readonly "black_runs": readonly (unknown)[];
    readonly "sync": {
    readonly "measured": boolean;
    readonly "max_offset_frames"?: number;
  };
    readonly "identity": {
    readonly "measured": boolean;
    readonly "scorer_revision"?: string;
    readonly "calibration_profile_revision"?: (null) | (string);
    readonly "verdict"?: "pass" | "fail" | "uncertain";
  };
  };
export type MediaQcProfile = {
    readonly "schema_version": "media_qc_profile_v1";
    readonly "profile_id": string;
    readonly "profile_revision": number;
    readonly "frame_rate": {
    readonly "num": number;
    readonly "den": number;
    readonly "mode": "cfr";
  };
    readonly "resolutions": {
    readonly "16:9": readonly ({
    readonly "width": number;
    readonly "height": number;
  })[];
    readonly "9:16": readonly ({
    readonly "width": number;
    readonly "height": number;
  })[];
    readonly "1:1": readonly ({
    readonly "width": number;
    readonly "height": number;
  })[];
  };
    readonly "color": {
    readonly "transfer": "sdr";
    readonly "primaries": "bt709";
  };
    readonly "audio": {
    readonly "sample_rate_hz": number;
  };
    readonly "duration": {
    readonly "frame_count": "exact";
    readonly "container_tolerance_frames": number;
  };
    readonly "black_frames": {
    readonly "luma_max": number;
    readonly "pixel_ratio_min": number;
    readonly "min_consecutive_frames": number;
    readonly "on_detect": "review";
  };
    readonly "sync": {
    readonly "max_offset_frames": number;
  };
    readonly "identity": {
    readonly "calibration": {
    readonly "positives_min": number;
    readonly "negatives_min": number;
    readonly "false_accepts_max": number;
    readonly "positive_recall_min": number;
  };
    readonly "auto_pass_requires_calibration": true;
  };
    readonly "repair": {
    readonly "max_automatic_repairs_per_shot": number;
  };
  };
export type MediaQcReport = {
    readonly "schema_version": "media_qc_report_v1";
    readonly "profile": unknown;
    readonly "artifact": unknown;
    readonly "expectation": {
    readonly "aspect_ratio": "16:9" | "9:16" | "1:1";
    readonly "frame_count": (null) | (number);
    readonly "audio_required": boolean;
    readonly "allowed_black_ranges": readonly (unknown)[];
    readonly "identity_required": boolean;
    readonly "sync_required": boolean;
  };
    readonly "checks": readonly ({
    readonly "check_id": "decode" | "frame_count" | "frame_rate" | "resolution" | "audio" | "black_frames" | "sync" | "identity";
    readonly "result": "pass" | "fail" | "review" | "not_measured" | "not_applicable";
    readonly "detail"?: string;
  })[];
    readonly "hard_failure": boolean;
    readonly "semantic_verdict": "pass" | "fail" | "uncertain";
    readonly "decision": "accept" | "repair" | "attention";
  };

export const reader = new ContractPackageReader({
  package: "media-qc",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
