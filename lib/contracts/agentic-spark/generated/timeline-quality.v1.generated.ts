// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/timeline-quality/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/timeline-quality/v1/common.schema.json",
    "title": "timeline_quality_common_v1",
    "description": "Shared definitions of the timeline-quality v1 package (P05-09 timeline and final quality). Not a standalone document type. Ids, hashes and timestamps are owned by assistant-runtime v1; the QC profile reference, aspect ratios, check results, frame ranges and artifact refs by media-qc v1; stable shot ids by video-preparation v1.",
    "$defs": {
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
      "Frames": {
        "description": "A whole number of output frames (up to 4 hours at 60 fps, the timeline ceiling of the segmented render).",
        "type": "integer",
        "minimum": 0,
        "maximum": 864000
      },
      "PositiveFrames": {
        "type": "integer",
        "minimum": 1,
        "maximum": 864000
      },
      "SignedFrames": {
        "type": "integer",
        "minimum": -864000,
        "maximum": 864000
      },
      "ItemId": {
        "description": "Stable id of a timeline item (the shot or generation shot the take belongs to).",
        "$ref": "https://youtorch.local/contracts/agentic-spark/video-preparation/v1/common.schema.json#/$defs/StableId"
      },
      "SlotId": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/assistant-runtime/v1/common.schema.json#/$defs/OpaqueId"
      },
      "AspectRatio": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/media-qc/v1/common.schema.json#/$defs/AspectRatio"
      },
      "CheckResult": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/media-qc/v1/common.schema.json#/$defs/CheckResult"
      },
      "ProfileRef": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/media-qc/v1/common.schema.json#/$defs/ProfileRef"
      },
      "FrameRange": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/media-qc/v1/common.schema.json#/$defs/FrameRange"
      },
      "ArtifactRef": {
        "$ref": "https://youtorch.local/contracts/agentic-spark/media-qc/v1/common.schema.json#/$defs/ArtifactRef"
      },
      "TransitionKind": {
        "description": "Transitions that consume media around the cut (a cut or no transition needs no handle).",
        "enum": [
          "fade",
          "dissolve",
          "wipe",
          "match_cut"
        ]
      },
      "ColorTags": {
        "description": "The colour tags a stream carries; null = untagged.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "primaries",
          "transfer",
          "matrix"
        ],
        "properties": {
          "primaries": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "string",
                "pattern": "^[a-z0-9_-]{1,32}$"
              }
            ]
          },
          "transfer": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "string",
                "pattern": "^[a-z0-9_-]{1,32}$"
              }
            ]
          },
          "matrix": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "string",
                "pattern": "^[a-z0-9_-]{1,32}$"
              }
            ]
          }
        }
      },
      "Size": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "width",
          "height"
        ],
        "properties": {
          "width": {
            "type": "integer",
            "minimum": 1,
            "maximum": 16384
          },
          "height": {
            "type": "integer",
            "minimum": 1,
            "maximum": 16384
          }
        }
      }
    }
  },
  "final-quality-measurement.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/timeline-quality/v1/final-quality-measurement.schema.json",
    "title": "final_quality_measurement_v1",
    "description": "What one measurement run observed on one FINAL render output (P05-09): decode, exact decoded frame count, frame rate, size, colour tags, container duration and faststart, audio format and its start offset, BS.1770 integrated loudness and true peak, black runs and, when the output carries golden sync markers, the marker offsets at the start, middle and end checkpoints. Facts only; the verdict is the evaluation against the frozen thresholds (final_quality_report_v1). Anything that could not be measured is null, never a guessed pass.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "artifact",
      "measured_at",
      "measurer",
      "decode",
      "video",
      "container",
      "audio",
      "loudness",
      "black_runs",
      "markers"
    ],
    "properties": {
      "schema_version": {
        "const": "final_quality_measurement_v1"
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
            "description": "Final QC primitive revision + FFmpeg build.",
            "type": "string",
            "minLength": 1,
            "maxLength": 128
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
              "size",
              "duration_ms",
              "color"
            ],
            "properties": {
              "frame_count": {
                "description": "Decoded frames (counted, not the container's claim).",
                "$ref": "common.schema.json#/$defs/Frames"
              },
              "frame_rate": {
                "$ref": "common.schema.json#/$defs/Rational"
              },
              "vfr": {
                "type": "boolean"
              },
              "size": {
                "$ref": "common.schema.json#/$defs/Size"
              },
              "duration_ms": {
                "type": "integer",
                "minimum": 0,
                "maximum": 3600000000
              },
              "color": {
                "$ref": "common.schema.json#/$defs/ColorTags"
              }
            }
          }
        ]
      },
      "container": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "duration_ms",
          "faststart"
        ],
        "properties": {
          "duration_ms": {
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "integer",
                "minimum": 0,
                "maximum": 3600000000
              }
            ]
          },
          "faststart": {
            "description": "true = the moov atom precedes the media data; null = not measured.",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "boolean"
              }
            ]
          }
        }
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
              "codec",
              "sample_rate_hz",
              "channels",
              "duration_ms",
              "start_offset_ms"
            ],
            "properties": {
              "codec": {
                "type": "string",
                "pattern": "^[a-z0-9_]{1,32}$"
              },
              "sample_rate_hz": {
                "type": "integer",
                "minimum": 1,
                "maximum": 384000
              },
              "channels": {
                "type": "integer",
                "minimum": 1,
                "maximum": 16
              },
              "duration_ms": {
                "type": "integer",
                "minimum": 0,
                "maximum": 3600000000
              },
              "start_offset_ms": {
                "description": "Audio start time minus video start time.",
                "type": "number",
                "minimum": -10000,
                "maximum": 10000
              }
            }
          }
        ]
      },
      "loudness": {
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "method",
              "integrated_lufs",
              "true_peak_dbtp"
            ],
            "properties": {
              "method": {
                "const": "bs1770_ebur128"
              },
              "integrated_lufs": {
                "type": "number",
                "minimum": -120,
                "maximum": 10
              },
              "true_peak_dbtp": {
                "type": "number",
                "minimum": -120,
                "maximum": 20
              }
            }
          }
        ]
      },
      "black_runs": {
        "type": "array",
        "maxItems": 200,
        "items": {
          "$ref": "common.schema.json#/$defs/FrameRange"
        }
      },
      "markers": {
        "description": "Golden fixtures only: the offset (output frames, signed, audio marker time minus video marker frame) at the three checkpoints. null = the output carries no sync markers.",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "start",
              "mid",
              "end"
            ],
            "properties": {
              "start": {
                "$ref": "#/$defs/MarkerOffset"
              },
              "mid": {
                "$ref": "#/$defs/MarkerOffset"
              },
              "end": {
                "$ref": "#/$defs/MarkerOffset"
              }
            }
          }
        ]
      }
    },
    "$defs": {
      "MarkerOffset": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "frame",
          "offset_frames"
        ],
        "properties": {
          "frame": {
            "description": "The output frame the marker was expected on.",
            "$ref": "common.schema.json#/$defs/Frames"
          },
          "offset_frames": {
            "type": "number",
            "minimum": -1000,
            "maximum": 1000
          }
        }
      }
    }
  },
  "final-quality-report.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/timeline-quality/v1/final-quality-report.schema.json",
    "title": "final_quality_report_v1",
    "description": "The common QC report of one FINAL render output (P05-09): the exact timeline and encode checks, the start/middle/end sync checkpoints, loudness and true peak, faststart, black frames and the identity/continuity result of every join, against the FROZEN thresholds of `spark-media-qc-v1` revision 1 and the `spark-export-v1` export profile. The thresholds are consts of this document: a 30-60 second output, a 2 minute one and a 10 minute one are judged by the same numbers, a longer video is never given a wider tolerance and a threshold is never relaxed after a result was seen (a new value is a new profile revision and a new document version). A hard media failure (timeline, encode, sync, loudness, faststart) is kept apart from the semantic verdict (black frames, joins). `not_measured` is never a pass: an output with an unmeasured required check is `attention`, never `accept`.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "profile",
      "export_profile_id",
      "artifact",
      "expectation",
      "thresholds",
      "checks",
      "joins",
      "hard_failure",
      "semantic_verdict",
      "decision"
    ],
    "properties": {
      "schema_version": {
        "const": "final_quality_report_v1"
      },
      "profile": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "profile_id",
          "profile_revision"
        ],
        "properties": {
          "profile_id": {
            "const": "spark-media-qc-v1"
          },
          "profile_revision": {
            "const": 1
          }
        }
      },
      "export_profile_id": {
        "const": "spark-export-v1"
      },
      "artifact": {
        "$ref": "common.schema.json#/$defs/ArtifactRef"
      },
      "expectation": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "total_frames",
          "fps",
          "size",
          "aspect_ratio",
          "audio_required",
          "allowed_black_ranges",
          "sync_markers"
        ],
        "properties": {
          "total_frames": {
            "description": "The manifest's exact frame count.",
            "$ref": "common.schema.json#/$defs/PositiveFrames"
          },
          "fps": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "num",
              "den"
            ],
            "properties": {
              "num": {
                "const": 30
              },
              "den": {
                "const": 1
              }
            }
          },
          "size": {
            "$ref": "common.schema.json#/$defs/Size"
          },
          "aspect_ratio": {
            "$ref": "common.schema.json#/$defs/AspectRatio"
          },
          "audio_required": {
            "type": "boolean"
          },
          "allowed_black_ranges": {
            "type": "array",
            "maxItems": 50,
            "items": {
              "$ref": "common.schema.json#/$defs/FrameRange"
            }
          },
          "sync_markers": {
            "description": "The frames the golden sync markers were placed on (start, middle, end checkpoints). null = the output carries no markers: the sync checkpoints are then not applicable and the A/V alignment check stands alone.",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "start",
                  "mid",
                  "end"
                ],
                "properties": {
                  "start": {
                    "$ref": "common.schema.json#/$defs/Frames"
                  },
                  "mid": {
                    "$ref": "common.schema.json#/$defs/Frames"
                  },
                  "end": {
                    "$ref": "common.schema.json#/$defs/Frames"
                  }
                }
              }
            ]
          }
        }
      },
      "thresholds": {
        "description": "The numbers this report was judged by. Consts: identical at every duration.",
        "type": "object",
        "additionalProperties": false,
        "required": [
          "frame_count",
          "container_tolerance_frames",
          "sync_max_offset_frames",
          "loudness_target_lufs",
          "loudness_tolerance_lu",
          "true_peak_max_dbtp"
        ],
        "properties": {
          "frame_count": {
            "const": "exact"
          },
          "container_tolerance_frames": {
            "const": 1
          },
          "sync_max_offset_frames": {
            "const": 1
          },
          "loudness_target_lufs": {
            "const": -14
          },
          "loudness_tolerance_lu": {
            "const": 1
          },
          "true_peak_max_dbtp": {
            "const": -1
          }
        }
      },
      "checks": {
        "type": "array",
        "minItems": 16,
        "maxItems": 16,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "check_id",
            "result"
          ],
          "properties": {
            "check_id": {
              "enum": [
                "decode",
                "frame_count",
                "container_duration",
                "frame_rate",
                "resolution",
                "color",
                "audio_format",
                "av_alignment",
                "sync_start",
                "sync_mid",
                "sync_end",
                "loudness",
                "true_peak",
                "faststart",
                "black_frames",
                "joins"
              ]
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
      "joins": {
        "description": "The identity/continuity result of every join between generated shots (P05-03 measures them; the same QC profile, the same report).",
        "type": "array",
        "maxItems": 512,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "from_shot_id",
            "to_shot_id",
            "result"
          ],
          "properties": {
            "from_shot_id": {
              "$ref": "common.schema.json#/$defs/ItemId"
            },
            "to_shot_id": {
              "$ref": "common.schema.json#/$defs/ItemId"
            },
            "result": {
              "$ref": "common.schema.json#/$defs/CheckResult"
            }
          }
        }
      },
      "hard_failure": {
        "type": "boolean"
      },
      "semantic_verdict": {
        "enum": [
          "pass",
          "fail",
          "uncertain"
        ]
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
  },
  "normalization-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/timeline-quality/v1/normalization-plan.schema.json",
    "title": "normalization_plan_v1",
    "description": "The typed transform that brings one probed source to the output profile (P05-09; KARAR-FRAME-EXTRACT renderer QC profile): 30 fps CFR, one of the six canvases, SDR BT.709, 48 kHz audio. The source is kept; a generation whose fps, size, colour or audio differ is normalized by these steps in a fixed order (resample fps, reframe aspect, scale, colour, audio). A 29.97, 25, 60 or variable-rate source is sampled to 30 CFR by timestamp (frames dropped or repeated) and the audio is never retimed (F35). A source the profile cannot serve (HDR, a canvas or rate outside the profile) is `unsupported` with its reason: it is never passed through silently, and a source in 4K/VFR is not a reason to open a 4K/VFR final. Aspect changes name their owner: the layout decides the crop, this plan only says a reframe is required.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "source",
      "target",
      "steps",
      "audio_retimed",
      "unsupported",
      "verdict"
    ],
    "properties": {
      "schema_version": {
        "const": "normalization_plan_v1"
      },
      "source": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "size",
          "fps",
          "vfr",
          "color",
          "audio"
        ],
        "properties": {
          "size": {
            "$ref": "common.schema.json#/$defs/Size"
          },
          "fps": {
            "$ref": "common.schema.json#/$defs/Rational"
          },
          "vfr": {
            "type": "boolean"
          },
          "color": {
            "$ref": "common.schema.json#/$defs/ColorTags"
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
                  "channels"
                ],
                "properties": {
                  "sample_rate_hz": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 384000
                  },
                  "channels": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 16
                  }
                }
              }
            ]
          }
        }
      },
      "target": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "size",
          "aspect_ratio",
          "fps",
          "audio_sample_rate_hz"
        ],
        "properties": {
          "size": {
            "$ref": "common.schema.json#/$defs/Size"
          },
          "aspect_ratio": {
            "$ref": "common.schema.json#/$defs/AspectRatio"
          },
          "fps": {
            "$ref": "common.schema.json#/$defs/Rational"
          },
          "audio_sample_rate_hz": {
            "type": "integer",
            "minimum": 1,
            "maximum": 384000
          }
        }
      },
      "steps": {
        "type": "array",
        "maxItems": 8,
        "items": {
          "oneOf": [
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "step",
                "method",
                "from",
                "to"
              ],
              "properties": {
                "step": {
                  "const": "resample_fps"
                },
                "method": {
                  "const": "timestamp_sampling"
                },
                "from": {
                  "$ref": "common.schema.json#/$defs/Rational"
                },
                "to": {
                  "$ref": "common.schema.json#/$defs/Rational"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "step",
                "mode",
                "decided_by"
              ],
              "properties": {
                "step": {
                  "const": "reframe_aspect"
                },
                "mode": {
                  "const": "cover"
                },
                "decided_by": {
                  "const": "layout"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "step",
                "from",
                "to"
              ],
              "properties": {
                "step": {
                  "const": "scale"
                },
                "from": {
                  "$ref": "common.schema.json#/$defs/Size"
                },
                "to": {
                  "$ref": "common.schema.json#/$defs/Size"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "step",
                "to",
                "basis"
              ],
              "properties": {
                "step": {
                  "const": "convert_color"
                },
                "to": {
                  "const": "bt709_sdr"
                },
                "basis": {
                  "const": "tagged_sdr_other_primaries"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "step",
                "to",
                "basis"
              ],
              "properties": {
                "step": {
                  "const": "tag_color"
                },
                "to": {
                  "const": "bt709_sdr"
                },
                "basis": {
                  "const": "untagged_assumed_bt709"
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "step",
                "from_hz",
                "to_hz",
                "retime"
              ],
              "properties": {
                "step": {
                  "const": "resample_audio"
                },
                "from_hz": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 384000
                },
                "to_hz": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 384000
                },
                "retime": {
                  "const": false
                }
              }
            }
          ]
        }
      },
      "audio_retimed": {
        "description": "Always false: the audio is never retimed to follow a resampled video (F35).",
        "const": false
      },
      "unsupported": {
        "type": "array",
        "maxItems": 8,
        "uniqueItems": true,
        "items": {
          "enum": [
            "color_hdr_unsupported",
            "target_canvas_not_in_profile",
            "target_fps_not_in_profile"
          ]
        }
      },
      "verdict": {
        "enum": [
          "ready",
          "unsupported"
        ]
      }
    }
  },
  "render-readiness.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/timeline-quality/v1/render-readiness.schema.json",
    "title": "render_readiness_v1",
    "description": "The gate in front of a render manifest (P05-09): a final (or accurate proxy) manifest never starts while a required asset is still pending or failed. An optional slot that is not ready blocks too, unless an explicit omission policy (the user, the plan or the channel preference, with its revision) allows leaving it out; every omission is then recorded in the result and stays visible. Nothing is left out silently and a required slot is never omitted. The document carries the slots it judged, so anyone can recompute the verdict.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "purpose",
      "slots",
      "omit_policy",
      "ready",
      "blockers",
      "omissions",
      "manifest_may_start"
    ],
    "properties": {
      "schema_version": {
        "const": "render_readiness_v1"
      },
      "purpose": {
        "enum": [
          "final",
          "accurate_proxy"
        ]
      },
      "slots": {
        "type": "array",
        "maxItems": 2000,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "slot_id",
            "slot_kind",
            "state",
            "media_kind"
          ],
          "properties": {
            "slot_id": {
              "$ref": "common.schema.json#/$defs/SlotId"
            },
            "slot_kind": {
              "description": "ShotPlan slot_kind: a required slot stops the plan when it has no source.",
              "enum": [
                "required",
                "optional"
              ]
            },
            "state": {
              "enum": [
                "ready",
                "pending",
                "failed"
              ]
            },
            "media_kind": {
              "enum": [
                "video",
                "image",
                "audio"
              ]
            }
          }
        }
      },
      "omit_policy": {
        "description": "The explicit permission to leave an optional slot out. Absent (null) means every optional slot that is not ready blocks.",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "source",
              "revision"
            ],
            "properties": {
              "source": {
                "enum": [
                  "user",
                  "plan",
                  "channel_preference"
                ]
              },
              "revision": {
                "type": "string",
                "minLength": 1,
                "maxLength": 128
              }
            }
          }
        ]
      },
      "ready": {
        "type": "boolean"
      },
      "blockers": {
        "type": "array",
        "maxItems": 2000,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "slot_id",
            "reason"
          ],
          "properties": {
            "slot_id": {
              "$ref": "common.schema.json#/$defs/SlotId"
            },
            "reason": {
              "enum": [
                "required_pending",
                "required_failed",
                "optional_unresolved"
              ]
            }
          }
        }
      },
      "omissions": {
        "type": "array",
        "maxItems": 2000,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "slot_id",
            "reason"
          ],
          "properties": {
            "slot_id": {
              "$ref": "common.schema.json#/$defs/SlotId"
            },
            "reason": {
              "enum": [
                "optional_pending",
                "optional_failed"
              ]
            }
          }
        }
      },
      "manifest_may_start": {
        "type": "boolean"
      }
    },
    "allOf": [
      {
        "description": "Nothing is left out without an explicit policy.",
        "if": {
          "properties": {
            "omissions": {
              "minItems": 1
            }
          }
        },
        "then": {
          "properties": {
            "omit_policy": {
              "type": "object"
            }
          }
        }
      }
    ]
  },
  "timeline-budget.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/timeline-quality/v1/timeline-budget.schema.json",
    "title": "timeline_budget_v1",
    "description": "The exact frame arithmetic of a long timeline from the ACTUAL takes (P05-09). Each item is a take with its actual generated frames; its usable window is what is left after the handles a transition may consume and the frames that are unusable. The timeline is the sum of the usable windows: Composition document v1 has no transition overlap and handles are extra generated frames, never timeline time. A transition whose handles are not there is downgraded to a cut and reported, never silently. The result is compared to the target with the fit limits the plan approved: an exact match, a match inside the approved fit, or a decision (short/long); the narration text and the scenes are never silently cut to fit. Integer frames throughout: the same arithmetic serves 45 seconds and 10 minutes.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "fps",
      "target_frames",
      "items",
      "totals",
      "fit",
      "verdict",
      "issues"
    ],
    "properties": {
      "schema_version": {
        "const": "timeline_budget_v1"
      },
      "fps": {
        "$ref": "common.schema.json#/$defs/Rational"
      },
      "target_frames": {
        "$ref": "common.schema.json#/$defs/PositiveFrames"
      },
      "items": {
        "type": "array",
        "minItems": 1,
        "maxItems": 500,
        "items": {
          "$ref": "#/$defs/Item"
        }
      },
      "totals": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "usable_frames",
          "timeline_frames",
          "delta_frames"
        ],
        "properties": {
          "usable_frames": {
            "$ref": "common.schema.json#/$defs/PositiveFrames"
          },
          "timeline_frames": {
            "$ref": "common.schema.json#/$defs/PositiveFrames"
          },
          "delta_frames": {
            "description": "timeline_frames - target_frames: negative = short, positive = long.",
            "$ref": "common.schema.json#/$defs/SignedFrames"
          }
        }
      },
      "fit": {
        "description": "The fit limits the plan approved (G1), in frames; null = no fit was approved, so any difference is a decision.",
        "oneOf": [
          {
            "type": "null"
          },
          {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "short_frames_max",
              "long_frames_max"
            ],
            "properties": {
              "short_frames_max": {
                "$ref": "common.schema.json#/$defs/Frames"
              },
              "long_frames_max": {
                "$ref": "common.schema.json#/$defs/Frames"
              }
            }
          }
        ]
      },
      "verdict": {
        "enum": [
          "exact",
          "within_fit",
          "short_needs_decision",
          "long_needs_decision"
        ]
      },
      "issues": {
        "type": "array",
        "maxItems": 200,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "code",
            "item_id"
          ],
          "properties": {
            "code": {
              "enum": [
                "transition_downgraded_to_cut",
                "transition_without_predecessor"
              ]
            },
            "item_id": {
              "$ref": "common.schema.json#/$defs/ItemId"
            }
          }
        }
      }
    },
    "$defs": {
      "Item": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "item_id",
          "generated_frames",
          "handle_in_frames",
          "handle_out_frames",
          "unusable_frames",
          "usable_frames",
          "transition_in"
        ],
        "properties": {
          "item_id": {
            "$ref": "common.schema.json#/$defs/ItemId"
          },
          "generated_frames": {
            "description": "Frames the provider actually returned (measured on the take).",
            "$ref": "common.schema.json#/$defs/PositiveFrames"
          },
          "handle_in_frames": {
            "description": "Extra generated frames before the usable window (a transition may consume them).",
            "$ref": "common.schema.json#/$defs/Frames"
          },
          "handle_out_frames": {
            "description": "Extra generated frames after the usable window.",
            "$ref": "common.schema.json#/$defs/Frames"
          },
          "unusable_frames": {
            "description": "Frames inside the window that cannot be used (a glitch the QC found).",
            "$ref": "common.schema.json#/$defs/Frames"
          },
          "usable_frames": {
            "description": "generated - handle_in - handle_out - unusable; at least one.",
            "$ref": "common.schema.json#/$defs/PositiveFrames"
          },
          "transition_in": {
            "description": "The transition from the previous item into this one (null: a plain cut).",
            "oneOf": [
              {
                "type": "null"
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "window_frames",
                  "needed_out_frames",
                  "needed_in_frames",
                  "status"
                ],
                "properties": {
                  "kind": {
                    "$ref": "common.schema.json#/$defs/TransitionKind"
                  },
                  "window_frames": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 300
                  },
                  "needed_out_frames": {
                    "description": "ceil(window / 2) frames of the previous item's outgoing handle.",
                    "$ref": "common.schema.json#/$defs/Frames"
                  },
                  "needed_in_frames": {
                    "description": "window - needed_out frames of this item's incoming handle.",
                    "$ref": "common.schema.json#/$defs/Frames"
                  },
                  "status": {
                    "enum": [
                      "renderable",
                      "downgraded_to_cut"
                    ]
                  }
                }
              }
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
  "media-qc/v1/common.schema.json": {
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
  }
} as const;

export const DOCUMENT_TYPES = ["final-quality-measurement", "final-quality-report", "normalization-plan", "render-readiness", "timeline-budget"] as const;
export type DocumentType = "final-quality-measurement" | "final-quality-report" | "normalization-plan" | "render-readiness" | "timeline-budget";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "final-quality-measurement": [
    "final_quality_measurement_v1"
  ],
  "final-quality-report": [
    "final_quality_report_v1"
  ],
  "normalization-plan": [
    "normalization_plan_v1"
  ],
  "render-readiness": [
    "render_readiness_v1"
  ],
  "timeline-budget": [
    "timeline_budget_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {};

export type FinalQualityMeasurement = {
    readonly "schema_version": "final_quality_measurement_v1";
    readonly "artifact": unknown;
    readonly "measured_at": unknown;
    readonly "measurer": {
    readonly "implementation_revision": string;
  };
    readonly "decode": {
    readonly "opened": boolean;
    readonly "error": (null) | ("unreadable" | "truncated" | "no_video_stream" | "zero_frames" | "timeout");
  };
    readonly "video": (null) | ({
    readonly "frame_count": number;
    readonly "frame_rate": unknown;
    readonly "vfr": boolean;
    readonly "size": unknown;
    readonly "duration_ms": number;
    readonly "color": unknown;
  });
    readonly "container": {
    readonly "duration_ms": (null) | (number);
    readonly "faststart": (null) | (boolean);
  };
    readonly "audio": (null) | ({
    readonly "codec": string;
    readonly "sample_rate_hz": number;
    readonly "channels": number;
    readonly "duration_ms": number;
    readonly "start_offset_ms": number;
  });
    readonly "loudness": (null) | ({
    readonly "method": "bs1770_ebur128";
    readonly "integrated_lufs": number;
    readonly "true_peak_dbtp": number;
  });
    readonly "black_runs": readonly (unknown)[];
    readonly "markers": (null) | ({
    readonly "start": unknown;
    readonly "mid": unknown;
    readonly "end": unknown;
  });
  };
export type FinalQualityReport = {
    readonly "schema_version": "final_quality_report_v1";
    readonly "profile": {
    readonly "profile_id": "spark-media-qc-v1";
    readonly "profile_revision": 1;
  };
    readonly "export_profile_id": "spark-export-v1";
    readonly "artifact": unknown;
    readonly "expectation": {
    readonly "total_frames": number;
    readonly "fps": {
    readonly "num": 30;
    readonly "den": 1;
  };
    readonly "size": unknown;
    readonly "aspect_ratio": unknown;
    readonly "audio_required": boolean;
    readonly "allowed_black_ranges": readonly (unknown)[];
    readonly "sync_markers": (null) | ({
    readonly "start": number;
    readonly "mid": number;
    readonly "end": number;
  });
  };
    readonly "thresholds": {
    readonly "frame_count": "exact";
    readonly "container_tolerance_frames": 1;
    readonly "sync_max_offset_frames": 1;
    readonly "loudness_target_lufs": -14;
    readonly "loudness_tolerance_lu": 1;
    readonly "true_peak_max_dbtp": -1;
  };
    readonly "checks": readonly ({
    readonly "check_id": "decode" | "frame_count" | "container_duration" | "frame_rate" | "resolution" | "color" | "audio_format" | "av_alignment" | "sync_start" | "sync_mid" | "sync_end" | "loudness" | "true_peak" | "faststart" | "black_frames" | "joins";
    readonly "result": unknown;
    readonly "detail"?: string;
  })[];
    readonly "joins": readonly ({
    readonly "from_shot_id": unknown;
    readonly "to_shot_id": unknown;
    readonly "result": unknown;
  })[];
    readonly "hard_failure": boolean;
    readonly "semantic_verdict": "pass" | "fail" | "uncertain";
    readonly "decision": "accept" | "repair" | "attention";
  };
export type NormalizationPlan = {
    readonly "schema_version": "normalization_plan_v1";
    readonly "source": {
    readonly "size": unknown;
    readonly "fps": unknown;
    readonly "vfr": boolean;
    readonly "color": unknown;
    readonly "audio": (null) | ({
    readonly "sample_rate_hz": number;
    readonly "channels": number;
  });
  };
    readonly "target": {
    readonly "size": unknown;
    readonly "aspect_ratio": unknown;
    readonly "fps": unknown;
    readonly "audio_sample_rate_hz": number;
  };
    readonly "steps": readonly (({
    readonly "step": "resample_fps";
    readonly "method": "timestamp_sampling";
    readonly "from": unknown;
    readonly "to": unknown;
  }) | ({
    readonly "step": "reframe_aspect";
    readonly "mode": "cover";
    readonly "decided_by": "layout";
  }) | ({
    readonly "step": "scale";
    readonly "from": unknown;
    readonly "to": unknown;
  }) | ({
    readonly "step": "convert_color";
    readonly "to": "bt709_sdr";
    readonly "basis": "tagged_sdr_other_primaries";
  }) | ({
    readonly "step": "tag_color";
    readonly "to": "bt709_sdr";
    readonly "basis": "untagged_assumed_bt709";
  }) | ({
    readonly "step": "resample_audio";
    readonly "from_hz": number;
    readonly "to_hz": number;
    readonly "retime": false;
  }))[];
    readonly "audio_retimed": false;
    readonly "unsupported": readonly ("color_hdr_unsupported" | "target_canvas_not_in_profile" | "target_fps_not_in_profile")[];
    readonly "verdict": "ready" | "unsupported";
  };
export type RenderReadiness = {
    readonly "schema_version": "render_readiness_v1";
    readonly "purpose": "final" | "accurate_proxy";
    readonly "slots": readonly ({
    readonly "slot_id": unknown;
    readonly "slot_kind": "required" | "optional";
    readonly "state": "ready" | "pending" | "failed";
    readonly "media_kind": "video" | "image" | "audio";
  })[];
    readonly "omit_policy": (null) | ({
    readonly "source": "user" | "plan" | "channel_preference";
    readonly "revision": string;
  });
    readonly "ready": boolean;
    readonly "blockers": readonly ({
    readonly "slot_id": unknown;
    readonly "reason": "required_pending" | "required_failed" | "optional_unresolved";
  })[];
    readonly "omissions": readonly ({
    readonly "slot_id": unknown;
    readonly "reason": "optional_pending" | "optional_failed";
  })[];
    readonly "manifest_may_start": boolean;
  };
export type TimelineBudget = {
    readonly "schema_version": "timeline_budget_v1";
    readonly "fps": unknown;
    readonly "target_frames": number;
    readonly "items": readonly (unknown)[];
    readonly "totals": {
    readonly "usable_frames": number;
    readonly "timeline_frames": number;
    readonly "delta_frames": number;
  };
    readonly "fit": (null) | ({
    readonly "short_frames_max": number;
    readonly "long_frames_max": number;
  });
    readonly "verdict": "exact" | "within_fit" | "short_needs_decision" | "long_needs_decision";
    readonly "issues": readonly ({
    readonly "code": "transition_downgraded_to_cut" | "transition_without_predecessor";
    readonly "item_id": unknown;
  })[];
  };

export const reader = new ContractPackageReader({
  package: "timeline-quality",
  schemas: { ...SCHEMAS, ...DEPENDENCY_SCHEMAS } as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
