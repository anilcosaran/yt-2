// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/ai-shot/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "ai-shot-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ai-shot/v1/ai-shot-plan.schema.json",
    "title": "ai_shot_plan_v1",
    "description": "The AI shot recipe for one slot (SS2.3, Q89). ai_shot fixes every Workflow step: optional reference cleanup (background_remove@1), the keyframe (image_generate@1, one cleaned product reference, text-free), image to video (video_generate@1 on the first enabled catalog model whose P04-04 capability report is supported: shortest duration, native ratio or an allowed crop, seed when supported), the deterministic trim (ai_shot_trim@1) and the resolution action. Automatic OCR/fidelity QC and automatic regeneration are out of scope (Q89): a technical failure (no output) is retried at most twice without a second charge, a disliked clip is a paid user regeneration or the 2.5D choice. Text, logos and numbers are never embedded (negative terms). Pending slots preview with the 2.5D fallback.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "slot_id",
      "decision",
      "reason_code",
      "question",
      "representational",
      "notices",
      "reference_cleanup",
      "keyframe",
      "image_to_video",
      "trim",
      "resolution",
      "retry",
      "fallback_2_5d",
      "preview",
      "billable"
    ],
    "properties": {
      "schema_version": {
        "const": "ai_shot_plan_v1"
      },
      "slot_id": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "decision": {
        "$ref": "common.schema.json#/$defs/Decision"
      },
      "reason_code": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/ReasonCode"
          },
          {
            "type": "null"
          }
        ]
      },
      "question": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "kind"
            ],
            "properties": {
              "kind": {
                "const": "product_photo"
              }
            }
          }
        ]
      },
      "representational": {
        "type": "boolean"
      },
      "notices": {
        "type": "array",
        "maxItems": 6,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/Notice"
        }
      },
      "reference_cleanup": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "node",
              "method",
              "reference_count"
            ],
            "properties": {
              "node": {
                "const": "background_remove@1"
              },
              "method": {
                "const": "comfy_matting"
              },
              "reference_count": {
                "type": "integer",
                "minimum": 1,
                "maximum": 4
              }
            }
          }
        ]
      },
      "keyframe": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "node",
              "model_id",
              "count",
              "reference_count",
              "ratio",
              "negative_terms"
            ],
            "properties": {
              "node": {
                "const": "image_generate@1"
              },
              "model_id": {
                "$ref": "common.schema.json#/$defs/ModelId"
              },
              "count": {
                "description": "1 = first frame; 2 = first and last frame (the video model takes a last frame).",
                "type": "integer",
                "minimum": 1,
                "maximum": 2
              },
              "reference_count": {
                "type": "integer",
                "minimum": 0,
                "maximum": 1
              },
              "ratio": {
                "$ref": "common.schema.json#/$defs/Ratio"
              },
              "negative_terms": {
                "type": "array",
                "minItems": 1,
                "maxItems": 16,
                "uniqueItems": true,
                "items": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 40
                }
              }
            }
          }
        ]
      },
      "image_to_video": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "node",
              "model_id",
              "duration_seconds",
              "aspect_ratio",
              "resolution",
              "last_frame",
              "seed",
              "native_audio",
              "crop_to",
              "negative_terms"
            ],
            "properties": {
              "node": {
                "const": "video_generate@1"
              },
              "model_id": {
                "$ref": "common.schema.json#/$defs/ModelId"
              },
              "duration_seconds": {
                "type": "integer",
                "minimum": 1,
                "maximum": 600
              },
              "aspect_ratio": {
                "$ref": "common.schema.json#/$defs/Ratio"
              },
              "resolution": {
                "oneOf": [
                  {
                    "type": "string",
                    "pattern": "^(?:[1-9][0-9]{2,3}p|[1-8]K)$"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "last_frame": {
                "type": "boolean"
              },
              "seed": {
                "oneOf": [
                  {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 2147483647
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "native_audio": {
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "crop_to": {
                "oneOf": [
                  {
                    "$ref": "common.schema.json#/$defs/Ratio"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "negative_terms": {
                "type": "array",
                "minItems": 1,
                "maxItems": 16,
                "uniqueItems": true,
                "items": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 40
                }
              }
            }
          }
        ]
      },
      "trim": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "node",
              "need_seconds",
              "motion_need"
            ],
            "properties": {
              "node": {
                "const": "ai_shot_trim@1"
              },
              "need_seconds": {
                "$ref": "common.schema.json#/$defs/SecondsNeed"
              },
              "motion_need": {
                "$ref": "common.schema.json#/$defs/MotionNeed"
              }
            }
          }
        ]
      },
      "resolution": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "output_short_edge",
              "clip_short_edge",
              "action"
            ],
            "properties": {
              "output_short_edge": {
                "type": "integer",
                "minimum": 240,
                "maximum": 4320
              },
              "clip_short_edge": {
                "oneOf": [
                  {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 8640
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "action": {
                "enum": [
                  "none",
                  "upscale_plan_line",
                  "low_resolution_badge"
                ]
              }
            }
          }
        ]
      },
      "retry": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "max_technical_retries",
          "technical_retry_charged",
          "dislike"
        ],
        "properties": {
          "max_technical_retries": {
            "const": 2
          },
          "technical_retry_charged": {
            "const": false
          },
          "dislike": {
            "const": "user_paid_regeneration_or_2_5d"
          }
        }
      },
      "fallback_2_5d": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "move",
              "source"
            ],
            "properties": {
              "move": {
                "$ref": "common.schema.json#/$defs/FallbackMove"
              },
              "source": {
                "const": "product_image"
              }
            }
          }
        ]
      },
      "preview": {
        "enum": [
          "fallback_2_5d",
          "placeholder"
        ]
      },
      "billable": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "video",
              "image"
            ],
            "properties": {
              "video": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "model_id",
                  "seconds"
                ],
                "properties": {
                  "model_id": {
                    "$ref": "common.schema.json#/$defs/ModelId"
                  },
                  "seconds": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 600
                  }
                }
              },
              "image": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "model_id",
                  "count"
                ],
                "properties": {
                  "model_id": {
                    "$ref": "common.schema.json#/$defs/ModelId"
                  },
                  "count": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 2
                  }
                }
              }
            }
          }
        ]
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "decision": {
              "const": "ai_shot"
            }
          }
        },
        "then": {
          "properties": {
            "reason_code": {
              "type": "null"
            },
            "question": {
              "type": "null"
            },
            "keyframe": {
              "type": "object"
            },
            "image_to_video": {
              "type": "object"
            },
            "trim": {
              "type": "object"
            },
            "resolution": {
              "type": "object"
            },
            "billable": {
              "type": "object"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "decision": {
              "enum": [
                "question",
                "fallback_2_5d",
                "no_ai"
              ]
            }
          }
        },
        "then": {
          "properties": {
            "reason_code": {
              "$ref": "common.schema.json#/$defs/ReasonCode"
            },
            "reference_cleanup": {
              "type": "null"
            },
            "keyframe": {
              "type": "null"
            },
            "image_to_video": {
              "type": "null"
            },
            "trim": {
              "type": "null"
            },
            "resolution": {
              "type": "null"
            },
            "billable": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "decision": {
              "const": "question"
            }
          }
        },
        "then": {
          "properties": {
            "question": {
              "type": "object"
            },
            "reason_code": {
              "const": "product_image_required"
            }
          }
        },
        "else": {
          "properties": {
            "question": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "decision": {
              "const": "fallback_2_5d"
            }
          }
        },
        "then": {
          "properties": {
            "fallback_2_5d": {
              "type": "object"
            },
            "preview": {
              "const": "fallback_2_5d"
            }
          }
        }
      }
    ]
  },
  "ai-shot-request.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ai-shot/v1/ai-shot-request.schema.json",
    "title": "ai_shot_request_v1",
    "description": "What the director asks the AI shot recipe for one media slot (SS2.3): the slot need (purpose, prompt, seconds, motion, ratio, whether the product itself is shown, Q39 representational flag), the film context (kind, physical product, whether AI generation is allowed at all - Q32 'AI uretim kullanma', the Video style visual direction block for light/ground/lens) and the output size. Product images are the user's own (never invented).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "slot",
      "film",
      "output",
      "product_images"
    ],
    "properties": {
      "schema_version": {
        "const": "ai_shot_request_v1"
      },
      "slot": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "slot_id",
          "purpose",
          "prompt",
          "need_seconds",
          "motion_need",
          "ratio",
          "shows_product",
          "representational"
        ],
        "properties": {
          "slot_id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "purpose": {
            "$ref": "common.schema.json#/$defs/SlotPurpose"
          },
          "prompt": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "need_seconds": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 30
          },
          "motion_need": {
            "$ref": "common.schema.json#/$defs/MotionNeed"
          },
          "ratio": {
            "$ref": "common.schema.json#/$defs/Ratio"
          },
          "shows_product": {
            "type": "boolean"
          },
          "representational": {
            "type": "boolean"
          },
          "fallback_move": {
            "$ref": "common.schema.json#/$defs/FallbackMove"
          }
        }
      },
      "film": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "film_id",
          "physical_product",
          "ai_generation_allowed",
          "visual_direction"
        ],
        "properties": {
          "film_id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "physical_product": {
            "type": "boolean"
          },
          "ai_generation_allowed": {
            "type": "boolean"
          },
          "visual_direction": {
            "type": "string",
            "maxLength": 2000
          }
        }
      },
      "output": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "short_edge_px",
          "ratio"
        ],
        "properties": {
          "short_edge_px": {
            "type": "integer",
            "minimum": 240,
            "maximum": 4320
          },
          "ratio": {
            "$ref": "common.schema.json#/$defs/Ratio"
          }
        }
      },
      "product_images": {
        "type": "array",
        "maxItems": 4,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/StorageObjectId"
        }
      }
    }
  },
  "ai-shot-trim.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ai-shot/v1/ai-shot-trim.schema.json",
    "title": "ai_shot_trim_v1",
    "description": "ai_shot_trim@1 result (SS2.3 step 5 + resolution rule): the deterministic 0.6-2.5 s window of a generated clip chosen from per-frame motion energy and its stability (a guard band at both clip ends is skipped), plus the technical facts the recipe needs - clip size, whether its ratio matches the output, whether a crop to the output ratio keeps at least 0.9 of the output short edge, and the resolution action (none / upscale plan line when an upscale node exists / low-resolution badge). No semantic QC (Q89): no OCR, no fidelity score. The clip is not re-encoded; the engine applies the window.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "rules_revision",
      "status",
      "clip",
      "clip_seconds",
      "fps",
      "need_seconds",
      "motion_need",
      "window",
      "score",
      "motion",
      "technical"
    ],
    "properties": {
      "schema_version": {
        "const": "ai_shot_trim_v1"
      },
      "rules_revision": {
        "type": "integer",
        "minimum": 1
      },
      "status": {
        "description": "selected = a full window of need_seconds; clip_too_short = the whole clip is shorter than the need (the slot's time policy applies).",
        "enum": [
          "selected",
          "clip_too_short"
        ]
      },
      "clip": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storage_object_id",
          "checksum_sha256"
        ],
        "properties": {
          "storage_object_id": {
            "$ref": "common.schema.json#/$defs/StorageObjectId"
          },
          "checksum_sha256": {
            "$ref": "common.schema.json#/$defs/Sha256"
          }
        }
      },
      "clip_seconds": {
        "type": "number",
        "exclusiveMinimum": 0,
        "maximum": 600
      },
      "fps": {
        "type": "number",
        "exclusiveMinimum": 0,
        "maximum": 240
      },
      "need_seconds": {
        "$ref": "common.schema.json#/$defs/SecondsNeed"
      },
      "motion_need": {
        "$ref": "common.schema.json#/$defs/MotionNeed"
      },
      "window": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "start_seconds",
          "end_seconds"
        ],
        "properties": {
          "start_seconds": {
            "type": "number",
            "minimum": 0,
            "maximum": 600
          },
          "end_seconds": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 600
          }
        }
      },
      "score": {
        "type": "number",
        "minimum": -10,
        "maximum": 10
      },
      "motion": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "mean",
          "std"
        ],
        "properties": {
          "mean": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "std": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          }
        }
      },
      "technical": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "width",
          "height",
          "short_edge",
          "output_ratio",
          "ratio_matches",
          "crop",
          "output_short_edge",
          "resolution_action"
        ],
        "properties": {
          "width": {
            "type": "integer",
            "minimum": 1,
            "maximum": 8192
          },
          "height": {
            "type": "integer",
            "minimum": 1,
            "maximum": 8192
          },
          "short_edge": {
            "type": "integer",
            "minimum": 1,
            "maximum": 8192
          },
          "output_ratio": {
            "$ref": "common.schema.json#/$defs/Ratio"
          },
          "ratio_matches": {
            "type": "boolean"
          },
          "crop": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "short_edge",
                  "min_short_edge",
                  "allowed"
                ],
                "properties": {
                  "short_edge": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 8192
                  },
                  "min_short_edge": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 8192
                  },
                  "allowed": {
                    "type": "boolean"
                  }
                }
              }
            ]
          },
          "output_short_edge": {
            "type": "integer",
            "minimum": 240,
            "maximum": 4320
          },
          "resolution_action": {
            "enum": [
              "none",
              "upscale_plan_line",
              "low_resolution_badge"
            ]
          }
        }
      }
    }
  },
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/ai-shot/v1/common.schema.json",
    "title": "ai_shot_common_v1",
    "description": "Shared definitions for the P06-60 AI shot recipe (KARAR-PREMIUM-MOTION-KARISIM-DIKEY-SES-VE-DIL SS2.3, Q89): reference cleanup -> keyframe -> image to video on the P04-04 capability contract -> deterministic trim -> free 2.5D fallback. Not a standalone document type. Provider names never appear (Q91); model ids are public catalog ids.",
    "$defs": {
      "StorageObjectId": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128,
        "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]*$"
      },
      "Sha256": {
        "type": "string",
        "pattern": "^[0-9a-f]{64}$"
      },
      "ModelId": {
        "type": "string",
        "pattern": "^[a-z0-9][a-z0-9._:-]{0,127}$"
      },
      "Ratio": {
        "enum": [
          "16:9",
          "9:16",
          "1:1"
        ]
      },
      "MotionNeed": {
        "enum": [
          "static",
          "camera",
          "subject"
        ]
      },
      "SlotPurpose": {
        "description": "SlotMediaRequest purposes (Motion Film SS5.1). product_screen is AI only on explicit request and then representational (Q39).",
        "enum": [
          "atmosphere",
          "usage_moment",
          "background",
          "product_screen"
        ]
      },
      "FallbackMove": {
        "description": "Free engine 2.5D fallback built from the user's product photo: light sweep, fly-over or parallax.",
        "enum": [
          "sweep",
          "flyover",
          "parallax"
        ]
      },
      "Decision": {
        "description": "ai_shot = run the recipe; question = one short question first (product photo); fallback_2_5d = no AI shot, free 2.5D from the user's photo; no_ai = the slot is filled by Stock, user media or the engine (no AI line).",
        "enum": [
          "ai_shot",
          "question",
          "fallback_2_5d",
          "no_ai"
        ]
      },
      "ReasonCode": {
        "enum": [
          "ai_generation_declined",
          "product_image_required",
          "product_screen_requires_explicit_request",
          "no_enabled_capable_video_model",
          "no_enabled_image_model"
        ]
      },
      "Notice": {
        "enum": [
          "reference_cleanup_unavailable",
          "low_source_resolution",
          "aspect_ratio_follows_first_frame",
          "native_audio_always_on",
          "seed_unsupported",
          "cropped_from_wider_ratio"
        ]
      },
      "SecondsNeed": {
        "type": "number",
        "minimum": 0.6,
        "maximum": 2.5
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["ai-shot-plan", "ai-shot-request", "ai-shot-trim"] as const;
export type DocumentType = "ai-shot-plan" | "ai-shot-request" | "ai-shot-trim";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "ai-shot-plan": [
    "ai_shot_plan_v1"
  ],
  "ai-shot-request": [
    "ai_shot_request_v1"
  ],
  "ai-shot-trim": [
    "ai_shot_trim_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "ai-shot-trim": {
    "status": [
      "clip_too_short",
      "selected"
    ]
  }
};

export type AiShotPlan = {
    readonly "schema_version": "ai_shot_plan_v1";
    readonly "slot_id": string;
    readonly "decision": "ai_shot" | "question" | "fallback_2_5d" | "no_ai";
    readonly "reason_code": ("ai_generation_declined" | "product_image_required" | "product_screen_requires_explicit_request" | "no_enabled_capable_video_model" | "no_enabled_image_model") | (null);
    readonly "question": (null) | ({
    readonly "kind": "product_photo";
  });
    readonly "representational": boolean;
    readonly "notices": readonly ("reference_cleanup_unavailable" | "low_source_resolution" | "aspect_ratio_follows_first_frame" | "native_audio_always_on" | "seed_unsupported" | "cropped_from_wider_ratio")[];
    readonly "reference_cleanup": (null) | ({
    readonly "node": "background_remove@1";
    readonly "method": "comfy_matting";
    readonly "reference_count": number;
  });
    readonly "keyframe": (null) | ({
    readonly "node": "image_generate@1";
    readonly "model_id": string;
    readonly "count": number;
    readonly "reference_count": number;
    readonly "ratio": "16:9" | "9:16" | "1:1";
    readonly "negative_terms": readonly (string)[];
  });
    readonly "image_to_video": (null) | ({
    readonly "node": "video_generate@1";
    readonly "model_id": string;
    readonly "duration_seconds": number;
    readonly "aspect_ratio": "16:9" | "9:16" | "1:1";
    readonly "resolution": (string) | (null);
    readonly "last_frame": boolean;
    readonly "seed": (number) | (null);
    readonly "native_audio": (boolean) | (null);
    readonly "crop_to": ("16:9" | "9:16" | "1:1") | (null);
    readonly "negative_terms": readonly (string)[];
  });
    readonly "trim": (null) | ({
    readonly "node": "ai_shot_trim@1";
    readonly "need_seconds": number;
    readonly "motion_need": "static" | "camera" | "subject";
  });
    readonly "resolution": (null) | ({
    readonly "output_short_edge": number;
    readonly "clip_short_edge": (number) | (null);
    readonly "action": "none" | "upscale_plan_line" | "low_resolution_badge";
  });
    readonly "retry": {
    readonly "max_technical_retries": 2;
    readonly "technical_retry_charged": false;
    readonly "dislike": "user_paid_regeneration_or_2_5d";
  };
    readonly "fallback_2_5d": (null) | ({
    readonly "move": "sweep" | "flyover" | "parallax";
    readonly "source": "product_image";
  });
    readonly "preview": "fallback_2_5d" | "placeholder";
    readonly "billable": (null) | ({
    readonly "video": {
    readonly "model_id": string;
    readonly "seconds": number;
  };
    readonly "image": {
    readonly "model_id": string;
    readonly "count": number;
  };
  });
  };
export type AiShotRequest = {
    readonly "schema_version": "ai_shot_request_v1";
    readonly "slot": {
    readonly "slot_id": string;
    readonly "purpose": "atmosphere" | "usage_moment" | "background" | "product_screen";
    readonly "prompt": string;
    readonly "need_seconds": number;
    readonly "motion_need": "static" | "camera" | "subject";
    readonly "ratio": "16:9" | "9:16" | "1:1";
    readonly "shows_product": boolean;
    readonly "representational": boolean;
    readonly "fallback_move"?: "sweep" | "flyover" | "parallax";
  };
    readonly "film": {
    readonly "film_id": string;
    readonly "physical_product": boolean;
    readonly "ai_generation_allowed": boolean;
    readonly "visual_direction": string;
  };
    readonly "output": {
    readonly "short_edge_px": number;
    readonly "ratio": "16:9" | "9:16" | "1:1";
  };
    readonly "product_images": readonly (string)[];
  };
export type AiShotTrim = {
    readonly "schema_version": "ai_shot_trim_v1";
    readonly "rules_revision": number;
    readonly "status": "selected" | "clip_too_short";
    readonly "clip": {
    readonly "storage_object_id": string;
    readonly "checksum_sha256": string;
  };
    readonly "clip_seconds": number;
    readonly "fps": number;
    readonly "need_seconds": number;
    readonly "motion_need": "static" | "camera" | "subject";
    readonly "window": {
    readonly "start_seconds": number;
    readonly "end_seconds": number;
  };
    readonly "score": number;
    readonly "motion": {
    readonly "mean": number;
    readonly "std": number;
  };
    readonly "technical": {
    readonly "width": number;
    readonly "height": number;
    readonly "short_edge": number;
    readonly "output_ratio": "16:9" | "9:16" | "1:1";
    readonly "ratio_matches": boolean;
    readonly "crop": (null) | ({
    readonly "short_edge": number;
    readonly "min_short_edge": number;
    readonly "allowed": boolean;
  });
    readonly "output_short_edge": number;
    readonly "resolution_action": "none" | "upscale_plan_line" | "low_resolution_badge";
  };
  };

export const reader = new ContractPackageReader({
  package: "ai-shot",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
