// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/media-edit/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/media-edit/v1/common.schema.json",
    "title": "media_edit_common_v1",
    "description": "Shared definitions of the media-edit v1 package (P04-13): source-media AI edit is a separate operation (`media.edit`) next to the video generation capability (P04-04 `video.generate`). Nothing here is inferred from generation inputs: a first frame, a reference image or a model name never means source-video edit, mask or tracking support.",
    "$defs": {
      "EditKind": {
        "description": "What the edit changes. video_face_edit covers an intentional face/identity transformation the user asked for; it never disables identity QC for everything else (KARAR-FRAME-EXTRACT 'Intentional AI edit QC').",
        "enum": [
          "video_restyle",
          "video_object_edit",
          "video_face_edit",
          "video_background_edit",
          "image_edit"
        ]
      },
      "SourceMediaKind": {
        "enum": [
          "video",
          "image"
        ]
      },
      "TargetKind": {
        "description": "whole_frame = the full picture; region_box = a normalized box at an anchor tick; mask = a Storage mask asset; tracked_subject = a subject followed over time (needs provider tracking).",
        "enum": [
          "whole_frame",
          "region_box",
          "mask",
          "tracked_subject"
        ]
      },
      "AudioPreservation": {
        "description": "keep_source = the source audio of the edited range must survive the edit (a provider that drops audio needs the deterministic mux step); allow_change = the edit may change audio; none = the source range has no audio.",
        "enum": [
          "keep_source",
          "allow_change",
          "none"
        ]
      },
      "AccountGate": {
        "description": "A named provider-account readiness gate (for example a vendor portrait/material-library approval). Checked as an adapter/account gate; it is not a Youtorch consent step (Q23).",
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]{0,63}$"
      },
      "RegionCode": {
        "description": "Data region code (S7: a tenant setting + catalog region; no rule while no setting exists).",
        "type": "string",
        "pattern": "^[a-z]{2}(?:-[a-z0-9]{1,16}){0,2}$"
      },
      "NormalizedBox": {
        "description": "Box in normalized source-frame coordinates (0..1, origin top-left).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "x",
          "y",
          "width",
          "height"
        ],
        "properties": {
          "x": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "y": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "width": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 1
          },
          "height": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 1
          }
        }
      },
      "AspectRatio": {
        "type": "string",
        "pattern": "^[1-9][0-9]?:[1-9][0-9]?$"
      },
      "CapabilityField": {
        "enum": [
          "capability",
          "edit_kind",
          "source",
          "source_range",
          "target",
          "identity_references",
          "audio",
          "timing",
          "off_target",
          "human_subject",
          "account",
          "region"
        ]
      },
      "IssueSeverity": {
        "description": "error = the exact model/adapter/account/region cannot run this edit (no silent fallback, no silent model change); notice = it runs, but a guarantee the user might assume is only checked by QC.",
        "enum": [
          "error",
          "notice"
        ]
      },
      "IssueCode": {
        "enum": [
          "capability_undeclared",
          "capability_invalid",
          "edit_kind_unsupported",
          "source_media_unsupported",
          "source_duration_unknown",
          "source_duration_exceeds_limit",
          "partial_range_unsupported",
          "target_unsupported",
          "identity_references_unsupported",
          "identity_references_exceed_limit",
          "audio_restored_by_mux",
          "timing_checked_by_qc",
          "off_target_best_effort",
          "human_subject_not_allowed",
          "human_subject_unverified",
          "human_subject_requires_account_gate",
          "account_gate_not_ready",
          "region_not_allowed"
        ]
      },
      "QcCheck": {
        "enum": [
          "decode",
          "timing",
          "audio_preservation",
          "off_target_preservation",
          "target_changed",
          "non_target_identity",
          "target_identity"
        ]
      },
      "QcResult": {
        "enum": [
          "pass",
          "fail",
          "uncertain",
          "not_applicable"
        ]
      },
      "QcVerdict": {
        "enum": [
          "pass",
          "fail",
          "uncertain"
        ]
      }
    }
  },
  "media-edit-capabilities.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/media-edit/v1/media-edit-capabilities.schema.json",
    "title": "media_edit_capabilities_v1",
    "description": "What one exact Provider catalog model can do for the `media.edit` operation, declared in `resolved_model_config.media_edit_capabilities` (a separate key next to P04-04's `video_capabilities`). A model without this document is capability_undeclared for edits, whatever its generation inputs are. A declaration never exceeds its runtime adapter's implemented edit features (media-edit-rules.json `adapter_features`); no current adapter implements a source-media edit.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "operation",
      "edit_kinds",
      "source",
      "source_range",
      "targets",
      "preservation",
      "human_subjects",
      "account",
      "regions",
      "cancellation",
      "provider_concurrency"
    ],
    "properties": {
      "schema_version": {
        "const": "media_edit_capabilities_v1"
      },
      "operation": {
        "const": "media.edit"
      },
      "edit_kinds": {
        "type": "array",
        "minItems": 1,
        "maxItems": 5,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/EditKind"
        }
      },
      "source": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "media_kinds",
          "max_duration_seconds"
        ],
        "properties": {
          "media_kinds": {
            "type": "array",
            "minItems": 1,
            "maxItems": 2,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/SourceMediaKind"
            }
          },
          "max_duration_seconds": {
            "description": "Longest video source range the provider accepts; null only when video is not accepted.",
            "oneOf": [
              {
                "type": "integer",
                "minimum": 1,
                "maximum": 3600
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "source_range": {
        "description": "partial_range = the provider edits a sub-range of a longer source; false = only a whole (pre-cut) source is accepted.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "partial_range"
        ],
        "properties": {
          "partial_range": {
            "type": "boolean"
          }
        }
      },
      "targets": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kinds",
          "max_identity_references"
        ],
        "properties": {
          "kinds": {
            "type": "array",
            "minItems": 1,
            "maxItems": 4,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/TargetKind"
            }
          },
          "max_identity_references": {
            "description": "Identity reference images of the target subject. 0 = unsupported; a path that would use only the first image declares 0.",
            "type": "integer",
            "minimum": 0,
            "maximum": 8
          }
        }
      },
      "preservation": {
        "description": "What the provider itself preserves. Anything not guaranteed here is measured by targeted QC (no pixel-exact or mask/tracking guarantee is implied).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "audio_passthrough",
          "timing",
          "off_target"
        ],
        "properties": {
          "audio_passthrough": {
            "type": "boolean"
          },
          "timing": {
            "enum": [
              "exact",
              "approximate"
            ]
          },
          "off_target": {
            "enum": [
              "masked",
              "best_effort"
            ]
          }
        }
      },
      "human_subjects": {
        "description": "Provider input rule for sources showing people (portrait/material rules are an adapter/account gate, not a Youtorch consent check, Q23).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "policy",
          "account_gate"
        ],
        "properties": {
          "policy": {
            "enum": [
              "allowed",
              "requires_account_gate",
              "not_allowed"
            ]
          },
          "account_gate": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/AccountGate"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "policy": {
                  "const": "requires_account_gate"
                }
              }
            },
            "then": {
              "properties": {
                "account_gate": {
                  "$ref": "common.schema.json#/$defs/AccountGate"
                }
              }
            },
            "else": {
              "properties": {
                "account_gate": {
                  "type": "null"
                }
              }
            }
          }
        ]
      },
      "account": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "required_gates"
        ],
        "properties": {
          "required_gates": {
            "type": "array",
            "maxItems": 8,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/AccountGate"
            }
          }
        }
      },
      "regions": {
        "description": "Allowed data regions; an empty list means the model sets no region rule.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "allowed"
        ],
        "properties": {
          "allowed": {
            "type": "array",
            "maxItems": 16,
            "uniqueItems": true,
            "items": {
              "$ref": "common.schema.json#/$defs/RegionCode"
            }
          }
        }
      },
      "cancellation": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "provider_cancel"
        ],
        "properties": {
          "provider_cancel": {
            "enum": [
              "none",
              "queued_only",
              "any_state"
            ]
          }
        }
      },
      "provider_concurrency": {
        "description": "Declared vendor concurrency (informational; never exposed publicly).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "max_concurrent_jobs",
          "scope"
        ],
        "properties": {
          "max_concurrent_jobs": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              },
              {
                "type": "null"
              }
            ]
          },
          "scope": {
            "enum": [
              "model",
              "provider_account",
              "unknown"
            ]
          }
        }
      }
    }
  },
  "media-edit-capability-report.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/media-edit/v1/media-edit-capability-report.schema.json",
    "title": "media_edit_capability_report_v1",
    "description": "Result of validating one media_edit_request_v1 against one exact model's media_edit_capabilities_v1. `unsupported` when any issue is an error. Issues are ordered by media-edit-rules.json `issue_order` and never carry provider names, URLs, prompts or account identifiers.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "verdict",
      "issues"
    ],
    "properties": {
      "schema_version": {
        "const": "media_edit_capability_report_v1"
      },
      "verdict": {
        "enum": [
          "supported",
          "unsupported"
        ]
      },
      "issues": {
        "type": "array",
        "maxItems": 32,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "code",
            "field",
            "severity"
          ],
          "properties": {
            "code": {
              "$ref": "common.schema.json#/$defs/IssueCode"
            },
            "field": {
              "$ref": "common.schema.json#/$defs/CapabilityField"
            },
            "severity": {
              "$ref": "common.schema.json#/$defs/IssueSeverity"
            }
          }
        }
      }
    }
  },
  "media-edit-qc-report.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/media-edit/v1/media-edit-qc-report.schema.json",
    "title": "media_edit_qc_report_v1",
    "description": "Targeted QC of one immutable candidate take against its exact MediaEditSpec (profile media-edit-qc-v1 in media-edit-rules.json): decode, exact timing, audio and off-target preservation, that the requested change happened, and identity. An intentional face transformation makes only the target's identity check not_applicable; non-target identity stays required. `uncertain` never becomes a pass; the previous good take is never deleted.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "qc_profile",
      "spec_digest_sha256",
      "candidate",
      "attempt",
      "checks",
      "verdict",
      "next_action",
      "repairs_remaining"
    ],
    "properties": {
      "schema_version": {
        "const": "media_edit_qc_report_v1"
      },
      "qc_profile": {
        "const": "media-edit-qc-v1"
      },
      "spec_digest_sha256": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
      },
      "candidate": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
      },
      "attempt": {
        "type": "integer",
        "minimum": 1,
        "maximum": 3
      },
      "checks": {
        "type": "array",
        "minItems": 7,
        "maxItems": 7,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "check",
            "result",
            "metric",
            "threshold"
          ],
          "properties": {
            "check": {
              "$ref": "common.schema.json#/$defs/QcCheck"
            },
            "result": {
              "$ref": "common.schema.json#/$defs/QcResult"
            },
            "metric": {
              "oneOf": [
                {
                  "type": "number"
                },
                {
                  "type": "null"
                }
              ]
            },
            "threshold": {
              "oneOf": [
                {
                  "type": "number"
                },
                {
                  "type": "null"
                }
              ]
            }
          }
        }
      },
      "verdict": {
        "$ref": "common.schema.json#/$defs/QcVerdict"
      },
      "next_action": {
        "enum": [
          "apply_ready",
          "repair",
          "attention"
        ]
      },
      "repairs_remaining": {
        "type": "integer",
        "minimum": 0,
        "maximum": 2
      }
    }
  },
  "media-edit-request.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/media-edit/v1/media-edit-request.schema.json",
    "title": "media_edit_request_v1",
    "description": "The normalized capability point of one media edit (derived from a media_edit_spec_v1): kinds, counts and flags only. Never a URL, Storage id, prompt or instruction text.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "edit_kind",
      "source_media_kind",
      "source_duration_seconds",
      "partial_range",
      "target_kind",
      "identity_reference_count",
      "audio",
      "exact_timing",
      "human_subject",
      "account_gates_ready",
      "data_region"
    ],
    "properties": {
      "schema_version": {
        "const": "media_edit_request_v1"
      },
      "edit_kind": {
        "$ref": "common.schema.json#/$defs/EditKind"
      },
      "source_media_kind": {
        "$ref": "common.schema.json#/$defs/SourceMediaKind"
      },
      "source_duration_seconds": {
        "description": "Length of the edited source range (video); null for an image or when unknown (a video with an unknown length is source_duration_unknown).",
        "oneOf": [
          {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 86400
          },
          {
            "type": "null"
          }
        ]
      },
      "partial_range": {
        "type": "boolean"
      },
      "target_kind": {
        "$ref": "common.schema.json#/$defs/TargetKind"
      },
      "identity_reference_count": {
        "type": "integer",
        "minimum": 0,
        "maximum": 16
      },
      "audio": {
        "$ref": "common.schema.json#/$defs/AudioPreservation"
      },
      "exact_timing": {
        "type": "boolean"
      },
      "human_subject": {
        "description": "Whether the edited range shows a person; null = not verified.",
        "oneOf": [
          {
            "type": "boolean"
          },
          {
            "type": "null"
          }
        ]
      },
      "account_gates_ready": {
        "type": "array",
        "maxItems": 16,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/AccountGate"
        }
      },
      "data_region": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/RegionCode"
          },
          {
            "type": "null"
          }
        ]
      }
    }
  },
  "media-edit-spec.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/media-edit/v1/media-edit-spec.schema.json",
    "title": "media_edit_spec_v1",
    "description": "The exact, immutable MediaEditSpec of one source-media AI edit (KARAR-BRAND-ELEMENTS \u00a75): the Composition target clip at its entity revision, the exact source asset (Storage object + checksum) and source range, the target region/identity references, the requested change, the preserve constraints, the output geometry and the capability snapshot it was validated against. Its canonical digest is part of the estimate/G1 fingerprint (K176): any change is a new spec. Q23/F46: there is deliberately no consent, provenance, watermark or synthetic-declaration field.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "operation",
      "project_id",
      "target",
      "source",
      "region",
      "change",
      "preserve",
      "output",
      "capability_snapshot"
    ],
    "properties": {
      "schema_version": {
        "const": "media_edit_spec_v1"
      },
      "operation": {
        "const": "media.edit"
      },
      "project_id": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "target": {
        "description": "The clip layer the edit will replace, pinned at its entity revision (F27 CAS: a changed clip makes the apply a conflict, never an overwrite).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "scene_id",
          "layer_id",
          "layer_rev"
        ],
        "properties": {
          "scene_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "layer_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "layer_rev": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/common.schema.json#/$defs/EntityRev"
          }
        }
      },
      "source": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "source_id",
          "storage_object",
          "media_kind",
          "timebase",
          "source_range",
          "duration_seconds",
          "has_audio"
        ],
        "properties": {
          "source_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "storage_object": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
          },
          "media_kind": {
            "$ref": "common.schema.json#/$defs/SourceMediaKind"
          },
          "timebase": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/common.schema.json#/$defs/Rational"
          },
          "source_range": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/common.schema.json#/$defs/SourceRange"
          },
          "duration_seconds": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 86400
          },
          "has_audio": {
            "type": "boolean"
          }
        }
      },
      "region": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind",
          "identity_references"
        ],
        "properties": {
          "kind": {
            "$ref": "common.schema.json#/$defs/TargetKind"
          },
          "box": {
            "$ref": "common.schema.json#/$defs/NormalizedBox"
          },
          "anchor_tick": {
            "type": "integer",
            "minimum": 0
          },
          "mask": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
          },
          "identity_references": {
            "type": "array",
            "maxItems": 8,
            "items": {
              "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "region_box"
                }
              }
            },
            "then": {
              "required": [
                "box",
                "anchor_tick"
              ],
              "not": {
                "required": [
                  "mask"
                ]
              }
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "mask"
                }
              }
            },
            "then": {
              "required": [
                "mask"
              ],
              "not": {
                "anyOf": [
                  {
                    "required": [
                      "box"
                    ]
                  },
                  {
                    "required": [
                      "anchor_tick"
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
                  "enum": [
                    "whole_frame",
                    "tracked_subject"
                  ]
                }
              }
            },
            "then": {
              "not": {
                "anyOf": [
                  {
                    "required": [
                      "box"
                    ]
                  },
                  {
                    "required": [
                      "anchor_tick"
                    ]
                  },
                  {
                    "required": [
                      "mask"
                    ]
                  }
                ]
              }
            }
          }
        ]
      },
      "change": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "edit_kind",
          "instruction",
          "intentional_identity_change"
        ],
        "properties": {
          "edit_kind": {
            "$ref": "common.schema.json#/$defs/EditKind"
          },
          "instruction": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "intentional_identity_change": {
            "description": "The user asked to transform the target person's look (for example 'make my face funny'): the target's identity check is not a failure. Identity checks of every other person stay on.",
            "type": "boolean"
          }
        }
      },
      "preserve": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "audio",
          "timing",
          "off_target",
          "non_target_identity"
        ],
        "properties": {
          "audio": {
            "$ref": "common.schema.json#/$defs/AudioPreservation"
          },
          "timing": {
            "const": "exact"
          },
          "off_target": {
            "const": "preserve"
          },
          "non_target_identity": {
            "const": "preserve"
          }
        }
      },
      "output": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "aspect_ratio",
          "width",
          "height",
          "fps"
        ],
        "properties": {
          "aspect_ratio": {
            "$ref": "common.schema.json#/$defs/AspectRatio"
          },
          "width": {
            "type": "integer",
            "minimum": 16,
            "maximum": 8192
          },
          "height": {
            "type": "integer",
            "minimum": 16,
            "maximum": 8192
          },
          "fps": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/common.schema.json#/$defs/Rational"
          }
        }
      },
      "capability_snapshot": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "model_id",
          "capability_digest_sha256",
          "validator_revision"
        ],
        "properties": {
          "model_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/ModelId"
          },
          "capability_digest_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          },
          "validator_revision": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_.-]{0,63}$"
          }
        }
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
  "assistant-runtime/v1/owner-refs.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json",
    "title": "owner_ref_v1",
    "description": "Typed owner-specific reference union (MIMARI \u00a75.3). Each ref names its owner's own immutable version field; there is no universal revision_id. A visible label is never the identity or an authority; the owner resolver re-validates access on every dispatch. P00-03 owns these field names; P00-07 scope-grants and later packages reuse them (coordinator decision 26 Sep 2026).",
    "oneOf": [
      {
        "$ref": "#/$defs/SkillRevisionRef"
      },
      {
        "$ref": "#/$defs/CapabilityRef"
      },
      {
        "$ref": "#/$defs/ConnectorToolRef"
      },
      {
        "$ref": "#/$defs/ConnectedAccountRef"
      },
      {
        "$ref": "#/$defs/BrandRevisionRef"
      },
      {
        "$ref": "#/$defs/StorageObjectRef"
      },
      {
        "$ref": "#/$defs/ModelCatalogRef"
      },
      {
        "$ref": "#/$defs/AvatarRef"
      },
      {
        "$ref": "#/$defs/VoiceProfileRef"
      }
    ],
    "$defs": {
      "SkillRevisionRef": {
        "description": "Assistant-owned skill revision pinned by revision + body digest (MIMARI \u00a73). Owner: Assistant (P01D catalog).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "skill_id",
          "skill_revision_id",
          "skill_scope",
          "body_digest_sha256"
        ],
        "properties": {
          "ref_type": {
            "const": "skill_revision"
          },
          "skill_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "skill_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "skill_scope": {
            "enum": [
              "system_internal",
              "platform",
              "workspace",
              "personal"
            ]
          },
          "body_digest_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "CapabilityRef": {
        "description": "Abstract capability requirement. Carries no OAuth scope, credential, vendor tool id, mode or credit authority; the owning BC resolves it.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "capability_key",
          "owner_bc"
        ],
        "properties": {
          "ref_type": {
            "const": "capability"
          },
          "capability_key": {
            "$ref": "common.schema.json#/$defs/CapabilityKey"
          },
          "owner_bc": {
            "$ref": "common.schema.json#/$defs/OwnerBc"
          },
          "capability_revision": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "ConnectorToolRef": {
        "description": "Exact Connector tool revision. Remote metadata revision is not an execution pin (R03). Owner: Connector (P01C-24 refines field names after Wave 0).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "connector_definition_id",
          "tool_name",
          "tool_revision_id"
        ],
        "properties": {
          "ref_type": {
            "const": "connector_tool"
          },
          "connector_definition_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "tool_name": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_-]*(\\.[a-z][a-z0-9_-]*)+$",
            "maxLength": 128
          },
          "tool_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "ConnectedAccountRef": {
        "description": "Connected account (connection) reference. Secret-free: no token, scope or grant; ConnectionGrant is checked by Connector at dispatch.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "connector_definition_id",
          "connection_id",
          "connection_revision"
        ],
        "properties": {
          "ref_type": {
            "const": "connected_account"
          },
          "connector_definition_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "connection_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "connection_revision": {
            "$ref": "common.schema.json#/$defs/Version"
          }
        }
      },
      "BrandRevisionRef": {
        "description": "Brand immutable revision of a Kit/Element/Template/Motion definition, pinned by revision id + revision digest (P00-07 dependency pinning uses these names). Owner: Brand.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "brand_asset_kind",
          "brand_asset_id",
          "brand_revision_id",
          "brand_revision_digest_sha256"
        ],
        "properties": {
          "ref_type": {
            "const": "brand_revision"
          },
          "brand_asset_kind": {
            "enum": [
              "kit",
              "element",
              "template",
              "motion"
            ]
          },
          "brand_asset_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "brand_revision_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "brand_revision_digest_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "StorageObjectRef": {
        "description": "Storage object + checksum. A signed URL or file name is never a reference. Owner: Storage.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "storage_object_id",
          "checksum_sha256"
        ],
        "properties": {
          "ref_type": {
            "const": "storage_object"
          },
          "storage_object_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "checksum_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          },
          "media_kind": {
            "enum": [
              "video",
              "image",
              "audio",
              "document",
              "other"
            ]
          },
          "byte_size": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "ModelCatalogRef": {
        "description": "Provider model catalog entry + capability revision. A client label or public alias alone is not the effective model.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "model_id",
          "model_catalog_revision",
          "capability_key",
          "capability_revision"
        ],
        "properties": {
          "ref_type": {
            "const": "model_catalog"
          },
          "model_id": {
            "$ref": "common.schema.json#/$defs/ModelId"
          },
          "model_catalog_revision": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "capability_key": {
            "$ref": "common.schema.json#/$defs/CapabilityKey"
          },
          "capability_revision": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "AvatarRef": {
        "description": "Existing Avatar owner version (+ optional execution snapshot pinned by the owner at execution). No avatar_revision_id is invented.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "avatar_id",
          "avatar_version"
        ],
        "properties": {
          "ref_type": {
            "const": "avatar"
          },
          "avatar_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "avatar_version": {
            "$ref": "common.schema.json#/$defs/Version"
          },
          "execution_snapshot_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "execution_snapshot_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        },
        "dependentRequired": {
          "execution_snapshot_id": [
            "execution_snapshot_sha256"
          ],
          "execution_snapshot_sha256": [
            "execution_snapshot_id"
          ]
        }
      },
      "VoiceProfileRef": {
        "description": "Existing Voice profile owner version (+ optional execution snapshot of the resolved binding route).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref_type",
          "voice_profile_id",
          "voice_profile_version"
        ],
        "properties": {
          "ref_type": {
            "const": "voice_profile"
          },
          "voice_profile_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "voice_profile_version": {
            "$ref": "common.schema.json#/$defs/Version"
          },
          "execution_snapshot_id": {
            "$ref": "common.schema.json#/$defs/OpaqueId"
          },
          "execution_snapshot_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        },
        "dependentRequired": {
          "execution_snapshot_id": [
            "execution_snapshot_sha256"
          ],
          "execution_snapshot_sha256": [
            "execution_snapshot_id"
          ]
        }
      },
      "InvocationTargetRef": {
        "description": "What a tool invocation targets: an internal owner capability or an exact Connector tool revision.",
        "oneOf": [
          {
            "$ref": "#/$defs/CapabilityRef"
          },
          {
            "$ref": "#/$defs/ConnectorToolRef"
          }
        ]
      }
    }
  },
  "composition-project/v1/common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/composition-project/v1/common.schema.json",
    "title": "composition_project_common_v1",
    "description": "Shared definitions of the composition-project v1 package. Ids, hashes, versions and owner refs come from the main packages by $ref (single owner): assistant-runtime common/owner-refs, scope-grants, execution-pin, spend-envelope.",
    "$defs": {
      "EntityKind": {
        "description": "CAS entity kinds of a CompositionDocument (F27). scene_sequence is the parent of structural scene commands; a scene is the parent of its layer order; project_overlays and audio are the project-level parents. template_instance (P06-03) is a document template instance record (template_instances[]).",
        "enum": [
          "scene_sequence",
          "section",
          "scene",
          "layer",
          "project_overlays",
          "audio",
          "caption_track",
          "pending_slot",
          "source_media",
          "canvas",
          "template_instance"
        ]
      },
      "EntityRev": {
        "description": "Per-entity revision for the F27 read_set CAS; the first revision is 1.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
      },
      "WorkingCopyVersion": {
        "description": "Mutable working copy CAS counter of a project; every applied command increments it (base_revision of a command).",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Version"
      },
      "SeenWorkingCopyVersion": {
        "description": "TK-33: working_copy_version the user saw when asking for G2/export. The revision is cut only when head == seen (the CAS is P02-07's command); a mismatch returns a conflict and asks for a fresh preview.",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Version"
      },
      "Frame": {
        "description": "Integer frame at the document canvas fps.",
        "type": "integer",
        "minimum": 0
      },
      "FrameCount": {
        "type": "integer",
        "minimum": 1
      },
      "FrameRange": {
        "description": "Half-open [start_frame, end_frame) at the canvas fps; end_frame > start_frame (checked by the compiler).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "start_frame",
          "end_frame"
        ],
        "properties": {
          "start_frame": {
            "$ref": "common.schema.json#/$defs/Frame"
          },
          "end_frame": {
            "$ref": "common.schema.json#/$defs/Frame"
          }
        }
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
      "SourceRange": {
        "description": "Half-open [in_tick, out_tick) on the source media's rational timebase (SourceMedia.probe.timebase); the source is never copied or transcoded per scene.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "in_tick",
          "out_tick"
        ],
        "properties": {
          "in_tick": {
            "type": "integer",
            "minimum": 0
          },
          "out_tick": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "Origin": {
        "description": "TK-32 origin of a command, undo group or revision cut: user, agent (Assistant job) or system.",
        "enum": [
          "user",
          "agent",
          "system"
        ]
      },
      "ActorUserId": {
        "description": "TK-32 actor: the user; in agent/system work the user who started the job (P00-03 job initiator).",
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "EntityRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "entity_kind",
          "entity_id"
        ],
        "properties": {
          "entity_kind": {
            "$ref": "common.schema.json#/$defs/EntityKind"
          },
          "entity_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "EntityRevRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "entity_kind",
          "entity_id",
          "entity_rev"
        ],
        "properties": {
          "entity_kind": {
            "$ref": "common.schema.json#/$defs/EntityKind"
          },
          "entity_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "entity_rev": {
            "$ref": "common.schema.json#/$defs/EntityRev"
          }
        }
      },
      "PreparationArtifactRef": {
        "description": "Exact revision of a preparation artifact (VideoBrief/ScriptArtifact/ShotPlan/ProductionPlan owned by P02-01 revision base + P04-15 schemas) or a transcript revision (P06-33/P03-22).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "artifact_kind",
          "artifact_id",
          "artifact_revision"
        ],
        "properties": {
          "artifact_kind": {
            "enum": [
              "video_brief",
              "script",
              "shot_plan",
              "production_plan",
              "transcript"
            ]
          },
          "artifact_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "artifact_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Revision"
          }
        }
      },
      "RendererPin": {
        "description": "Renderer + render profile revision pinned by a project and copied into each RenderManifest (F43). Chosen by the P00-06 ADR.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "renderer_id",
          "renderer_revision",
          "profile_revision"
        ],
        "properties": {
          "renderer_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "renderer_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "profile_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          }
        }
      },
      "FontRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "font_id",
          "font_revision",
          "sha256"
        ],
        "properties": {
          "font_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "font_revision": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "AudioLicenseBinding": {
        "description": "P06-09 (F48): the licence revision of one music/sfx audio dependency of a manifest: which exact Storage object (id + checksum) on which project source, its basis (the platform's licensed catalogue revision, the user's rights declaration, or AI-generated audio under the provider licence), the immutable licence revision (a digest of the licence facts), the separately recorded allowed uses (project use, final distribution, commercial use, raw download, template redistribution), Content ID eligibility and the attribution the licence requires. A dependency without a usable licence is listed as missing or revoked with a reason: a proxy manifest may carry it, a final manifest never (render-manifest.schema.json).",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "asset",
          "source_id",
          "role",
          "status"
        ],
        "properties": {
          "asset": {
            "description": "The exact Storage object (id + checksum, Storage owns the ref) the licence is bound to.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/owner-refs.schema.json#/$defs/StorageObjectRef"
          },
          "source_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "role": {
            "enum": [
              "music",
              "sfx"
            ]
          },
          "status": {
            "enum": [
              "bound",
              "missing",
              "revoked"
            ]
          },
          "reason": {
            "description": "Why the dependency has no usable licence (missing: no catalogue acquisition, rights declaration or generation record; revoked: takedown or a withdrawn declaration).",
            "type": "string",
            "minLength": 1,
            "maxLength": 64
          },
          "basis": {
            "enum": [
              "platform_stock",
              "user_rights_declared",
              "ai_generated"
            ]
          },
          "license_revision": {
            "description": "alr_ + the first 32 hex characters of the sha256 of the canonical licence facts; the same facts always give the same revision.",
            "type": "string",
            "pattern": "^alr_[0-9a-f]{32}$"
          },
          "license_ref": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "allowed_uses": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "uniqueItems": true,
            "items": {
              "enum": [
                "project_use",
                "final_distribution",
                "commercial_use",
                "raw_download",
                "template_redistribution"
              ]
            }
          },
          "content_id_safe": {
            "description": "true: not expected to raise a platform claim; false: may; null: unknown (the user's declaration or the provider terms did not say).",
            "type": [
              "boolean",
              "null"
            ]
          },
          "attribution": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "required",
              "text"
            ],
            "properties": {
              "required": {
                "type": "boolean"
              },
              "text": {
                "type": [
                  "string",
                  "null"
                ],
                "maxLength": 500
              }
            }
          },
          "record": {
            "description": "The owner record the licence facts were read from (ids only; never a URL or a private text).",
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind"
            ],
            "properties": {
              "kind": {
                "enum": [
                  "catalog_item",
                  "declaration",
                  "generation"
                ]
              },
              "item_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "revision": {
                "type": "integer",
                "minimum": 1
              },
              "declaration_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              },
              "creation_id": {
                "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
              }
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "status": {
                  "const": "bound"
                }
              }
            },
            "then": {
              "required": [
                "basis",
                "license_revision",
                "license_ref",
                "allowed_uses",
                "content_id_safe",
                "attribution",
                "record"
              ]
            },
            "else": {
              "required": [
                "reason"
              ]
            }
          }
        ]
      },
      "MotionRevisionRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "motion_id",
          "motion_revision_id",
          "scope",
          "manifest_sha256"
        ],
        "properties": {
          "motion_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "motion_revision_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "scope": {
            "description": "library: reusable Motion owned by Brand; project_private: Q16 LLM Motion scene bound to one project (private immutable usable revision).",
            "enum": [
              "library",
              "project_private"
            ]
          },
          "manifest_sha256": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/Sha256"
          }
        }
      },
      "OperationRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "production_run_id",
          "operation_id"
        ],
        "properties": {
          "production_run_id": {
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          },
          "operation_id": {
            "description": "P00-03 logical_operation_id of the operation.",
            "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
          }
        }
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["media-edit-capabilities", "media-edit-capability-report", "media-edit-qc-report", "media-edit-request", "media-edit-spec"] as const;
export type DocumentType = "media-edit-capabilities" | "media-edit-capability-report" | "media-edit-qc-report" | "media-edit-request" | "media-edit-spec";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "media-edit-capabilities": [
    "media_edit_capabilities_v1"
  ],
  "media-edit-capability-report": [
    "media_edit_capability_report_v1"
  ],
  "media-edit-qc-report": [
    "media_edit_qc_report_v1"
  ],
  "media-edit-request": [
    "media_edit_request_v1"
  ],
  "media-edit-spec": [
    "media_edit_spec_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type MediaEditCapabilities = {
    readonly "schema_version": "media_edit_capabilities_v1";
    readonly "operation": "media.edit";
    readonly "edit_kinds": readonly ("video_restyle" | "video_object_edit" | "video_face_edit" | "video_background_edit" | "image_edit")[];
    readonly "source": {
    readonly "media_kinds": readonly ("video" | "image")[];
    readonly "max_duration_seconds": (number) | (null);
  };
    readonly "source_range": {
    readonly "partial_range": boolean;
  };
    readonly "targets": {
    readonly "kinds": readonly ("whole_frame" | "region_box" | "mask" | "tracked_subject")[];
    readonly "max_identity_references": number;
  };
    readonly "preservation": {
    readonly "audio_passthrough": boolean;
    readonly "timing": "exact" | "approximate";
    readonly "off_target": "masked" | "best_effort";
  };
    readonly "human_subjects": {
    readonly "policy": "allowed" | "requires_account_gate" | "not_allowed";
    readonly "account_gate": (string) | (null);
  };
    readonly "account": {
    readonly "required_gates": readonly (string)[];
  };
    readonly "regions": {
    readonly "allowed": readonly (string)[];
  };
    readonly "cancellation": {
    readonly "provider_cancel": "none" | "queued_only" | "any_state";
  };
    readonly "provider_concurrency": {
    readonly "max_concurrent_jobs": (number) | (null);
    readonly "scope": "model" | "provider_account" | "unknown";
  };
  };
export type MediaEditCapabilityReport = {
    readonly "schema_version": "media_edit_capability_report_v1";
    readonly "verdict": "supported" | "unsupported";
    readonly "issues": readonly ({
    readonly "code": "capability_undeclared" | "capability_invalid" | "edit_kind_unsupported" | "source_media_unsupported" | "source_duration_unknown" | "source_duration_exceeds_limit" | "partial_range_unsupported" | "target_unsupported" | "identity_references_unsupported" | "identity_references_exceed_limit" | "audio_restored_by_mux" | "timing_checked_by_qc" | "off_target_best_effort" | "human_subject_not_allowed" | "human_subject_unverified" | "human_subject_requires_account_gate" | "account_gate_not_ready" | "region_not_allowed";
    readonly "field": "capability" | "edit_kind" | "source" | "source_range" | "target" | "identity_references" | "audio" | "timing" | "off_target" | "human_subject" | "account" | "region";
    readonly "severity": "error" | "notice";
  })[];
  };
export type MediaEditQcReport = {
    readonly "schema_version": "media_edit_qc_report_v1";
    readonly "qc_profile": "media-edit-qc-v1";
    readonly "spec_digest_sha256": unknown;
    readonly "candidate": unknown;
    readonly "attempt": number;
    readonly "checks": readonly ({
    readonly "check": "decode" | "timing" | "audio_preservation" | "off_target_preservation" | "target_changed" | "non_target_identity" | "target_identity";
    readonly "result": "pass" | "fail" | "uncertain" | "not_applicable";
    readonly "metric": (number) | (null);
    readonly "threshold": (number) | (null);
  })[];
    readonly "verdict": "pass" | "fail" | "uncertain";
    readonly "next_action": "apply_ready" | "repair" | "attention";
    readonly "repairs_remaining": number;
  };
export type MediaEditRequest = {
    readonly "schema_version": "media_edit_request_v1";
    readonly "edit_kind": "video_restyle" | "video_object_edit" | "video_face_edit" | "video_background_edit" | "image_edit";
    readonly "source_media_kind": "video" | "image";
    readonly "source_duration_seconds": (number) | (null);
    readonly "partial_range": boolean;
    readonly "target_kind": "whole_frame" | "region_box" | "mask" | "tracked_subject";
    readonly "identity_reference_count": number;
    readonly "audio": "keep_source" | "allow_change" | "none";
    readonly "exact_timing": boolean;
    readonly "human_subject": (boolean) | (null);
    readonly "account_gates_ready": readonly (string)[];
    readonly "data_region": (string) | (null);
  };
export type MediaEditSpec = {
    readonly "schema_version": "media_edit_spec_v1";
    readonly "operation": "media.edit";
    readonly "project_id": unknown;
    readonly "target": {
    readonly "scene_id": unknown;
    readonly "layer_id": unknown;
    readonly "layer_rev": unknown;
  };
    readonly "source": {
    readonly "source_id": unknown;
    readonly "storage_object": unknown;
    readonly "media_kind": "video" | "image";
    readonly "timebase": unknown;
    readonly "source_range": unknown;
    readonly "duration_seconds": number;
    readonly "has_audio": boolean;
  };
    readonly "region": {
    readonly "kind": "whole_frame" | "region_box" | "mask" | "tracked_subject";
    readonly "box"?: unknown;
    readonly "anchor_tick"?: number;
    readonly "mask"?: unknown;
    readonly "identity_references": readonly (unknown)[];
  };
    readonly "change": {
    readonly "edit_kind": "video_restyle" | "video_object_edit" | "video_face_edit" | "video_background_edit" | "image_edit";
    readonly "instruction": string;
    readonly "intentional_identity_change": boolean;
  };
    readonly "preserve": {
    readonly "audio": "keep_source" | "allow_change" | "none";
    readonly "timing": "exact";
    readonly "off_target": "preserve";
    readonly "non_target_identity": "preserve";
  };
    readonly "output": {
    readonly "aspect_ratio": string;
    readonly "width": number;
    readonly "height": number;
    readonly "fps": unknown;
  };
    readonly "capability_snapshot": {
    readonly "model_id": unknown;
    readonly "capability_digest_sha256": unknown;
    readonly "validator_revision": string;
  };
  };

export const reader = new ContractPackageReader({
  package: "media-edit",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
