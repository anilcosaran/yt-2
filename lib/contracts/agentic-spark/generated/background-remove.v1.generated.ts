// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/background-remove/v1
//
// Every exported `<Stem>` type is a best-effort structural sketch for editor
// ergonomics only. Keywords that constrain values without changing shape
// (if/then/else, allOf, not, dependentRequired, pattern, format, min/max,
// multipleOf) are enforced by `read()` against SCHEMAS below, not by these
// static types -- a value can satisfy a type here and still be rejected by
// `read()`. Treat `read()` as authoritative.

import { ContractPackageReader } from "./runtime.generated";

export const SCHEMAS = {
  "background-composition.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/background-remove/v1/background-composition.schema.json",
    "title": "background_composition_v1",
    "description": "How the engine recomposes a background_remove_result_v1 (SS2.2 step 4): background (colour, gradient, image/video asset, blurred original or the original plate), the cut-out subject, an optional camera box and shadow, and text behind the subject. Changing any field is a free recompile in the engine, never a new removal run. Placement geometry and the camera box region come from PresenterLayout (motion-spark v1); frame and shadow appearance come from the Video style `camera_frame` token, so this document names the token instead of inventing styles. `text_behind_subject` puts text between the background and the subject; over the original background (kind `plate`) that needs the plate_split plate, over a replaced background the cut-out alone is enough.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "subject",
      "background",
      "frame",
      "shadow",
      "text_behind_subject"
    ],
    "properties": {
      "schema_version": {
        "const": "background_composition_v1"
      },
      "subject": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "subject_rgba",
          "matte",
          "plate"
        ],
        "properties": {
          "subject_rgba": {
            "$ref": "common.schema.json#/$defs/StorageObjectId"
          },
          "matte": {
            "$ref": "common.schema.json#/$defs/StorageObjectId"
          },
          "plate": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/StorageObjectId"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "background": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "kind"
        ],
        "properties": {
          "kind": {
            "description": "color / gradient = flat fills (brand colours come from the active Brand Kit); image / video = a Storage asset; blur_original = the source frame blurred behind the subject; plate = the subject-free plate (plate_split).",
            "enum": [
              "color",
              "gradient",
              "image",
              "video",
              "blur_original",
              "plate"
            ]
          },
          "color": {
            "$ref": "common.schema.json#/$defs/HexColor"
          },
          "gradient": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "stops",
              "angle_degrees"
            ],
            "properties": {
              "stops": {
                "type": "array",
                "minItems": 2,
                "maxItems": 4,
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "color",
                    "position"
                  ],
                  "properties": {
                    "color": {
                      "$ref": "common.schema.json#/$defs/HexColor"
                    },
                    "position": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 1
                    }
                  }
                }
              },
              "angle_degrees": {
                "type": "number",
                "minimum": 0,
                "maximum": 360
              }
            }
          },
          "asset": {
            "$ref": "common.schema.json#/$defs/StorageObjectId"
          },
          "blur_strength": {
            "description": "Relative blur strength of blur_original (0 = none, 1 = strongest the engine profile allows).",
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 1
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "color"
                }
              }
            },
            "then": {
              "required": [
                "color"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "gradient"
                }
              }
            },
            "then": {
              "required": [
                "gradient"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "enum": [
                    "image",
                    "video"
                  ]
                }
              }
            },
            "then": {
              "required": [
                "asset"
              ]
            }
          },
          {
            "if": {
              "properties": {
                "kind": {
                  "const": "blur_original"
                }
              }
            },
            "then": {
              "required": [
                "blur_strength"
              ]
            }
          }
        ]
      },
      "frame": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "shape"
        ],
        "properties": {
          "shape": {
            "enum": [
              "none",
              "rounded_rect",
              "circle"
            ]
          },
          "camera_frame_token": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          }
        }
      },
      "shadow": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "enabled"
        ],
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "camera_frame_token": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          }
        }
      },
      "text_behind_subject": {
        "type": "boolean"
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "background": {
              "properties": {
                "kind": {
                  "const": "plate"
                }
              }
            }
          }
        },
        "then": {
          "properties": {
            "subject": {
              "properties": {
                "plate": {
                  "$ref": "common.schema.json#/$defs/StorageObjectId"
                }
              }
            }
          }
        }
      }
    ]
  },
  "background-remove-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/background-remove/v1/background-remove-plan.schema.json",
    "title": "background_remove_plan_v1",
    "description": "Resolver verdict for one background_remove_request_v1 (SS2.2 step 2, SS2.6 order). runnable = the node runs `method`; in_generation_call = the removal is a parameter of the generation call itself (generation_param), no node step; refused = nothing runs and `reason_code` says why (never a silent fallback). `fallback_method` is what the planner offers when this method's QC fails after the repair budget. `chunking` is set for comfy video matting (balanced chunks of at most 30 s, 20-30 s whenever the duration allows, short overlap, frame-count QC on merge).",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "verdict",
      "method",
      "reason_code",
      "cost_class",
      "fallback_method",
      "max_repairs",
      "chunking"
    ],
    "properties": {
      "schema_version": {
        "const": "background_remove_plan_v1"
      },
      "verdict": {
        "enum": [
          "runnable",
          "in_generation_call",
          "refused"
        ]
      },
      "method": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/Method"
          },
          {
            "type": "null"
          }
        ]
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
      "cost_class": {
        "description": "free = chroma_key/engine work (no charge); in_generation = part of the generation price (no extra charge, K291a); gpu_metered = estimated before launch, settled on measured GPU time/receipt and never above the estimate ceiling; none = refused.",
        "enum": [
          "free",
          "in_generation",
          "gpu_metered",
          "none"
        ]
      },
      "fallback_method": {
        "oneOf": [
          {
            "const": "comfy_matting"
          },
          {
            "type": "null"
          }
        ]
      },
      "max_repairs": {
        "const": 2
      },
      "chunking": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "chunk_seconds",
              "overlap_seconds",
              "chunk_count"
            ],
            "properties": {
              "chunk_seconds": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 30
              },
              "overlap_seconds": {
                "type": "number",
                "minimum": 0,
                "maximum": 2
              },
              "chunk_count": {
                "type": "integer",
                "minimum": 1,
                "maximum": 20000
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
            "verdict": {
              "const": "runnable"
            }
          }
        },
        "then": {
          "properties": {
            "method": {
              "$ref": "common.schema.json#/$defs/Method"
            },
            "reason_code": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "verdict": {
              "const": "refused"
            }
          }
        },
        "then": {
          "properties": {
            "method": {
              "type": "null"
            },
            "reason_code": {
              "$ref": "common.schema.json#/$defs/ReasonCode"
            },
            "cost_class": {
              "const": "none"
            },
            "chunking": {
              "type": "null"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "verdict": {
              "const": "in_generation_call"
            }
          }
        },
        "then": {
          "properties": {
            "method": {
              "const": "generation_param"
            },
            "reason_code": {
              "const": "generation_param_in_generation_call"
            },
            "cost_class": {
              "const": "in_generation"
            },
            "chunking": {
              "type": "null"
            }
          }
        }
      }
    ]
  },
  "background-remove-request.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/background-remove/v1/background-remove-request.schema.json",
    "title": "background_remove_request_v1",
    "description": "One background removal request (SS2.3 input): the source asset (never modified; outputs are new Storage assets), its origin, an optional video range, subject hint, quality and mode. `method` is only an explicit override; normally the resolver picks it from the origin (background-remove-rules.json `method_selection`). `key_color` is known when we generated the subject over a key colour; otherwise chroma_key detects it from the frame border.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "source",
      "origin",
      "subject_hint",
      "quality",
      "mode"
    ],
    "properties": {
      "schema_version": {
        "const": "background_remove_request_v1"
      },
      "source": {
        "$ref": "common.schema.json#/$defs/SourceAsset"
      },
      "origin": {
        "$ref": "common.schema.json#/$defs/SourceOrigin"
      },
      "range": {
        "$ref": "common.schema.json#/$defs/TimeRange"
      },
      "subject_hint": {
        "$ref": "common.schema.json#/$defs/SubjectHint"
      },
      "quality": {
        "$ref": "common.schema.json#/$defs/Quality"
      },
      "mode": {
        "$ref": "common.schema.json#/$defs/Mode"
      },
      "method": {
        "$ref": "common.schema.json#/$defs/Method"
      },
      "key_color": {
        "$ref": "common.schema.json#/$defs/HexColor"
      },
      "alpha_codec": {
        "description": "Video only; images are always PNG.",
        "enum": [
          "prores_4444",
          "vp9_alpha"
        ]
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "source": {
              "properties": {
                "media_kind": {
                  "const": "image"
                }
              }
            }
          }
        },
        "then": {
          "not": {
            "anyOf": [
              {
                "required": [
                  "range"
                ]
              },
              {
                "required": [
                  "alpha_codec"
                ]
              }
            ]
          }
        }
      }
    ]
  },
  "background-remove-result.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/background-remove/v1/background-remove-result.schema.json",
    "title": "background_remove_result_v1",
    "description": "What one `background_remove@1` run produced (SS2.3 output): the transparent subject (`subject_rgba`), the greyscale matte, the plate in plate_split mode, and metadata (method, implementation revision, frame counts, QC). The source asset is never modified. completed = QC passed (final); attention = QC still failed after at most two repairs: the best attempt is kept but is not final, `reason_code` is qc_failed_after_repairs and `next_method` names the planned fallback (chroma_key -> comfy_matting). A broken cutout is never reported as completed.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "status",
      "final",
      "reason_code",
      "method",
      "source",
      "mode",
      "outputs",
      "key_color",
      "frames",
      "qc",
      "implementation",
      "cost",
      "next_method"
    ],
    "properties": {
      "schema_version": {
        "const": "background_remove_result_v1"
      },
      "status": {
        "enum": [
          "completed",
          "attention"
        ]
      },
      "final": {
        "type": "boolean"
      },
      "reason_code": {
        "oneOf": [
          {
            "const": "qc_failed_after_repairs"
          },
          {
            "type": "null"
          }
        ]
      },
      "method": {
        "$ref": "common.schema.json#/$defs/Method"
      },
      "source": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "asset"
        ],
        "properties": {
          "asset": {
            "$ref": "common.schema.json#/$defs/SourceAsset"
          },
          "range": {
            "$ref": "common.schema.json#/$defs/TimeRange"
          }
        }
      },
      "mode": {
        "$ref": "common.schema.json#/$defs/Mode"
      },
      "outputs": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "subject_rgba",
          "matte",
          "plate"
        ],
        "properties": {
          "subject_rgba": {
            "$ref": "common.schema.json#/$defs/OutputAsset"
          },
          "matte": {
            "$ref": "common.schema.json#/$defs/OutputAsset"
          },
          "plate": {
            "oneOf": [
              {
                "$ref": "common.schema.json#/$defs/OutputAsset"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "key_color": {
        "oneOf": [
          {
            "$ref": "common.schema.json#/$defs/HexColor"
          },
          {
            "type": "null"
          }
        ]
      },
      "frames": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "source",
          "output"
        ],
        "properties": {
          "source": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 1
              },
              {
                "type": "null"
              }
            ]
          },
          "output": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 1
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "qc": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "profile_revision",
          "calibration",
          "verdict",
          "checks",
          "attempts",
          "repairs_used"
        ],
        "properties": {
          "profile_revision": {
            "type": "integer",
            "minimum": 1
          },
          "calibration": {
            "description": "provisional = thresholds frozen before the first fixture eval (SS2.6); the eval freezes a new profile revision, never relaxes this one after a result is seen.",
            "enum": [
              "provisional",
              "calibrated"
            ]
          },
          "verdict": {
            "enum": [
              "pass",
              "fail"
            ]
          },
          "checks": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "id",
                "result",
                "value",
                "threshold"
              ],
              "properties": {
                "id": {
                  "$ref": "common.schema.json#/$defs/QcCheckId"
                },
                "result": {
                  "$ref": "common.schema.json#/$defs/CheckResult"
                },
                "value": {
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
          "attempts": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3
          },
          "repairs_used": {
            "type": "integer",
            "minimum": 0,
            "maximum": 2
          }
        }
      },
      "implementation": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "node",
          "impl_revision",
          "method_revision",
          "model"
        ],
        "properties": {
          "node": {
            "const": "background_remove@1"
          },
          "impl_revision": {
            "type": "integer",
            "minimum": 1
          },
          "method_revision": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9._+-]{0,127}$"
          },
          "model": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "family",
                  "license"
                ],
                "properties": {
                  "family": {
                    "$ref": "common.schema.json#/$defs/ModelFamily"
                  },
                  "license": {
                    "$ref": "common.schema.json#/$defs/ModelLicense"
                  }
                }
              }
            ]
          }
        }
      },
      "cost": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "cost_class",
          "credits_charged"
        ],
        "properties": {
          "cost_class": {
            "enum": [
              "free",
              "gpu_metered"
            ]
          },
          "credits_charged": {
            "type": "number",
            "minimum": 0
          }
        }
      },
      "next_method": {
        "oneOf": [
          {
            "const": "comfy_matting"
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
            "status": {
              "const": "completed"
            }
          }
        },
        "then": {
          "properties": {
            "final": {
              "const": true
            },
            "reason_code": {
              "type": "null"
            },
            "next_method": {
              "type": "null"
            },
            "qc": {
              "properties": {
                "verdict": {
                  "const": "pass"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "attention"
            }
          }
        },
        "then": {
          "properties": {
            "final": {
              "const": false
            },
            "reason_code": {
              "const": "qc_failed_after_repairs"
            },
            "qc": {
              "properties": {
                "verdict": {
                  "const": "fail"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "mode": {
              "const": "cutout"
            }
          }
        },
        "then": {
          "properties": {
            "outputs": {
              "properties": {
                "plate": {
                  "type": "null"
                }
              }
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "cost": {
              "properties": {
                "cost_class": {
                  "const": "free"
                }
              }
            }
          }
        },
        "then": {
          "properties": {
            "cost": {
              "properties": {
                "credits_charged": {
                  "const": 0
                }
              }
            }
          }
        }
      }
    ]
  },
  "common.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/background-remove/v1/common.schema.json",
    "title": "background_remove_common_v1",
    "description": "Shared definitions for the P06-49 background removal package (`background_remove@1`, capability `media.background_remove`; KARAR-REFERANS-KLON-VE-AVATAR-ARKA-PLAN SS2). Not a standalone document type. Provider and vendor names never appear here (Q91); model families appear only with their license.",
    "$defs": {
      "Method": {
        "description": "generation_param = the background is removed inside the generation call of a presenter route that declares `background_modes` remove/color/image (avatar-voice v1); chroma_key = FFmpeg key of a subject generated or filmed over a flat key colour (free); comfy_matting = open-licence matting (BiRefNet/BEN2 + SAM2) for existing or uploaded media.",
        "enum": [
          "generation_param",
          "chroma_key",
          "comfy_matting"
        ]
      },
      "SourceOrigin": {
        "description": "existing_media = uploaded or already stored media; generation_with_background_param = a subject we are about to generate on a route that removes/replaces the background as a generation parameter; generation_on_key_color = a subject generated (or filmed) over a known flat key colour.",
        "enum": [
          "existing_media",
          "generation_with_background_param",
          "generation_on_key_color"
        ]
      },
      "SubjectHint": {
        "enum": [
          "person",
          "product",
          "auto"
        ]
      },
      "Quality": {
        "enum": [
          "standard",
          "high"
        ]
      },
      "Mode": {
        "description": "cutout = transparent subject + matte; plate_split = cutout plus the background plate with the subject removed (text behind the subject).",
        "enum": [
          "cutout",
          "plate_split"
        ]
      },
      "MediaKind": {
        "enum": [
          "image",
          "video"
        ]
      },
      "AlphaCodec": {
        "description": "Transparent subject encoding. Video: ProRes 4444 MOV (near-lossless alpha, default) or VP9 alpha WebM (small, browser preview). Image: PNG.",
        "enum": [
          "prores_4444",
          "vp9_alpha",
          "png"
        ]
      },
      "MatteCodec": {
        "description": "Greyscale matte: H.264 MP4 luma for video (FFmpeg alphamerge input), greyscale PNG for images.",
        "enum": [
          "h264_gray",
          "png_gray"
        ]
      },
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
      "HexColor": {
        "type": "string",
        "pattern": "^#[0-9A-F]{6}$"
      },
      "SourceAsset": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storage_object_id",
          "checksum_sha256",
          "media_kind"
        ],
        "properties": {
          "storage_object_id": {
            "$ref": "#/$defs/StorageObjectId"
          },
          "checksum_sha256": {
            "$ref": "#/$defs/Sha256"
          },
          "media_kind": {
            "$ref": "#/$defs/MediaKind"
          }
        }
      },
      "TimeRange": {
        "description": "Seconds of the source video; end is exclusive and greater than start (checked by the rules, not expressible here).",
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
            "maximum": 86400
          },
          "end_seconds": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 86400
          }
        }
      },
      "OutputAsset": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storage_object_id",
          "content_type",
          "codec",
          "size_bytes",
          "width",
          "height",
          "frame_count"
        ],
        "properties": {
          "storage_object_id": {
            "$ref": "#/$defs/StorageObjectId"
          },
          "content_type": {
            "enum": [
              "video/quicktime",
              "video/webm",
              "video/mp4",
              "image/png"
            ]
          },
          "codec": {
            "enum": [
              "prores_4444",
              "vp9_alpha",
              "png",
              "h264_gray",
              "png_gray",
              "h264"
            ]
          },
          "size_bytes": {
            "type": "integer",
            "minimum": 1
          },
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
          "frame_count": {
            "oneOf": [
              {
                "type": "integer",
                "minimum": 1
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "ModelFamily": {
        "description": "Open-licence matting families allowed by the licence filter (SS2.4). RMBG-2.0 (non-commercial) and RobustVideoMatting (GPL-3.0) are never listed; SAM3/MatAnyone/SDMatte stay out until their licence is verified.",
        "enum": [
          "birefnet",
          "ben2",
          "sam2"
        ]
      },
      "ModelLicense": {
        "enum": [
          "MIT",
          "Apache-2.0"
        ]
      },
      "QcCheckId": {
        "description": "frame_count = output frames equal the decoded source range; subject_present = the subject is not keyed away; background_removed = the key colour/background is actually removed; temporal_flicker = variance of IoU between successive sampled mattes (video); edge_spill = share of edge pixels still carrying the key colour (halo).",
        "enum": [
          "frame_count",
          "subject_present",
          "background_removed",
          "temporal_flicker",
          "edge_spill"
        ]
      },
      "CheckResult": {
        "enum": [
          "pass",
          "fail",
          "not_measured"
        ]
      },
      "ReasonCode": {
        "description": "Safe, stable reason vocabulary (logs/UI). Never a provider name, URL or raw provider message.",
        "enum": [
          "generation_param_in_generation_call",
          "generation_param_unavailable",
          "method_not_available",
          "method_not_allowed_for_origin",
          "plate_split_requires_matting",
          "range_not_allowed_for_image",
          "range_invalid",
          "source_too_long",
          "key_color_not_found",
          "key_color_conflicts_with_subject",
          "license_blocked_model",
          "qc_failed_after_repairs"
        ]
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["background-composition", "background-remove-plan", "background-remove-request", "background-remove-result"] as const;
export type DocumentType = "background-composition" | "background-remove-plan" | "background-remove-request" | "background-remove-result";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "background-composition": [
    "background_composition_v1"
  ],
  "background-remove-plan": [
    "background_remove_plan_v1"
  ],
  "background-remove-request": [
    "background_remove_request_v1"
  ],
  "background-remove-result": [
    "background_remove_result_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "background-remove-result": {
    "status": [
      "attention",
      "completed"
    ]
  }
};

export type BackgroundComposition = {
    readonly "schema_version": "background_composition_v1";
    readonly "subject": {
    readonly "subject_rgba": string;
    readonly "matte": string;
    readonly "plate": (string) | (null);
  };
    readonly "background": {
    readonly "kind": "color" | "gradient" | "image" | "video" | "blur_original" | "plate";
    readonly "color"?: string;
    readonly "gradient"?: {
    readonly "stops": readonly ({
    readonly "color": string;
    readonly "position": number;
  })[];
    readonly "angle_degrees": number;
  };
    readonly "asset"?: string;
    readonly "blur_strength"?: number;
  };
    readonly "frame": {
    readonly "shape": "none" | "rounded_rect" | "circle";
    readonly "camera_frame_token"?: string;
  };
    readonly "shadow": {
    readonly "enabled": boolean;
    readonly "camera_frame_token"?: string;
  };
    readonly "text_behind_subject": boolean;
  };
export type BackgroundRemovePlan = {
    readonly "schema_version": "background_remove_plan_v1";
    readonly "verdict": "runnable" | "in_generation_call" | "refused";
    readonly "method": ("generation_param" | "chroma_key" | "comfy_matting") | (null);
    readonly "reason_code": ("generation_param_in_generation_call" | "generation_param_unavailable" | "method_not_available" | "method_not_allowed_for_origin" | "plate_split_requires_matting" | "range_not_allowed_for_image" | "range_invalid" | "source_too_long" | "key_color_not_found" | "key_color_conflicts_with_subject" | "license_blocked_model" | "qc_failed_after_repairs") | (null);
    readonly "cost_class": "free" | "in_generation" | "gpu_metered" | "none";
    readonly "fallback_method": ("comfy_matting") | (null);
    readonly "max_repairs": 2;
    readonly "chunking": (null) | ({
    readonly "chunk_seconds": number;
    readonly "overlap_seconds": number;
    readonly "chunk_count": number;
  });
  };
export type BackgroundRemoveRequest = {
    readonly "schema_version": "background_remove_request_v1";
    readonly "source": unknown;
    readonly "origin": "existing_media" | "generation_with_background_param" | "generation_on_key_color";
    readonly "range"?: unknown;
    readonly "subject_hint": "person" | "product" | "auto";
    readonly "quality": "standard" | "high";
    readonly "mode": "cutout" | "plate_split";
    readonly "method"?: "generation_param" | "chroma_key" | "comfy_matting";
    readonly "key_color"?: string;
    readonly "alpha_codec"?: "prores_4444" | "vp9_alpha";
  };
export type BackgroundRemoveResult = {
    readonly "schema_version": "background_remove_result_v1";
    readonly "status": "completed" | "attention";
    readonly "final": boolean;
    readonly "reason_code": ("qc_failed_after_repairs") | (null);
    readonly "method": "generation_param" | "chroma_key" | "comfy_matting";
    readonly "source": {
    readonly "asset": unknown;
    readonly "range"?: unknown;
  };
    readonly "mode": "cutout" | "plate_split";
    readonly "outputs": {
    readonly "subject_rgba": unknown;
    readonly "matte": unknown;
    readonly "plate": (unknown) | (null);
  };
    readonly "key_color": (string) | (null);
    readonly "frames": {
    readonly "source": (number) | (null);
    readonly "output": (number) | (null);
  };
    readonly "qc": {
    readonly "profile_revision": number;
    readonly "calibration": "provisional" | "calibrated";
    readonly "verdict": "pass" | "fail";
    readonly "checks": readonly ({
    readonly "id": "frame_count" | "subject_present" | "background_removed" | "temporal_flicker" | "edge_spill";
    readonly "result": "pass" | "fail" | "not_measured";
    readonly "value": (number) | (null);
    readonly "threshold": (number) | (null);
  })[];
    readonly "attempts": number;
    readonly "repairs_used": number;
  };
    readonly "implementation": {
    readonly "node": "background_remove@1";
    readonly "impl_revision": number;
    readonly "method_revision": string;
    readonly "model": (null) | ({
    readonly "family": "birefnet" | "ben2" | "sam2";
    readonly "license": "MIT" | "Apache-2.0";
  });
  };
    readonly "cost": {
    readonly "cost_class": "free" | "gpu_metered";
    readonly "credits_charged": number;
  };
    readonly "next_method": ("comfy_matting") | (null);
  };

export const reader = new ContractPackageReader({
  package: "background-remove",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
