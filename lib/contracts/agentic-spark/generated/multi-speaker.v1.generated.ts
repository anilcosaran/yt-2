// Generated from contracts/agentic-spark/<package>/v1; run scripts/generate_agentic_spark_contract_readers.py. Do not hand-edit.
//
// Package: contracts/agentic-spark/multi-speaker/v1
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
    "$id": "https://youtorch.local/contracts/agentic-spark/multi-speaker/v1/common.schema.json",
    "title": "multi_speaker_common_v1",
    "description": "Shared definitions for the P06-54 multi-speaker package (KARAR-ANLATIM-YERLESIM-KONUSMACI-VE-SABLONLAR SS7, Q49): diarization turns, their attribution onto the Whisper word timeline, speaker to face-track assignment, the speaker shot plan and media_sync@1. Not a standalone document type. Provider and route names never appear here (Q91).",
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
      "Seconds": {
        "type": "number",
        "minimum": 0,
        "maximum": 86400
      },
      "SpeakerLabel": {
        "description": "Stable per-source speaker label in order of first speech: S1, S2, ...",
        "type": "string",
        "pattern": "^S[1-9][0-9]?$"
      },
      "FaceTrackId": {
        "description": "Face track id of the existing face tracker (media_transform face tracking, positive integer).",
        "type": "integer",
        "minimum": 1,
        "maximum": 100000
      },
      "SourceRef": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "storage_object_id",
          "checksum_sha256"
        ],
        "properties": {
          "storage_object_id": {
            "$ref": "#/$defs/StorageObjectId"
          },
          "checksum_sha256": {
            "$ref": "#/$defs/Sha256"
          }
        }
      },
      "SyncMethod": {
        "description": "Priority order: timecode (ffprobe) -> gcc_phat (cross-correlation with the common recording, 16 kHz, 60 s windows) -> manual (user offset / clap point). none = not synchronised.",
        "enum": [
          "timecode",
          "gcc_phat",
          "manual",
          "none"
        ]
      },
      "SyncReason": {
        "description": "Why a source needs the user (sync_required): no usable timecode and no correlation peak with the common recording, too few consistent windows, or a drift the robust fit cannot explain.",
        "enum": [
          "no_common_audio",
          "too_few_consistent_windows",
          "drift_unfit",
          "no_audio_stream"
        ]
      },
      "ShotKind": {
        "description": "single = one speaker; split = two overlapping speakers (>1 s); group = three or more; reaction = inserted listener shot.",
        "enum": [
          "single",
          "split",
          "group",
          "reaction"
        ]
      }
    }
  },
  "media-sync-result.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/multi-speaker/v1/media-sync-result.schema.json",
    "title": "media_sync_result_v1",
    "description": "What media_sync@1 decided for separate recordings (SS7): per source the method (timecode -> GCC-PHAT against the common recording -> manual offset), the offset (reference_time = source_time + offset_seconds), the robust linear drift fit in ppm, the correction (aresample with a rate ratio when the drift over the source exceeds half a frame) and the residual error in frames at the start, middle and end after correction. A source that cannot be synchronised is `sync_required` with a reason; there is never a silent assumption. The whole result is synced only when every source is.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "status",
      "reference",
      "frame_rate",
      "sources"
    ],
    "properties": {
      "schema_version": {
        "const": "media_sync_result_v1"
      },
      "status": {
        "enum": [
          "synced",
          "sync_required"
        ]
      },
      "reference": {
        "$ref": "common.schema.json#/$defs/SourceRef"
      },
      "frame_rate": {
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
            "maximum": 240000
          },
          "den": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1001
          }
        }
      },
      "sources": {
        "type": "array",
        "minItems": 1,
        "maxItems": 8,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "source",
            "status",
            "method",
            "offset_seconds",
            "drift_ppm",
            "correction",
            "residual_frames",
            "windows",
            "reason"
          ],
          "properties": {
            "source": {
              "$ref": "common.schema.json#/$defs/SourceRef"
            },
            "status": {
              "enum": [
                "synced",
                "sync_required"
              ]
            },
            "method": {
              "$ref": "common.schema.json#/$defs/SyncMethod"
            },
            "offset_seconds": {
              "oneOf": [
                {
                  "type": "number",
                  "minimum": -86400,
                  "maximum": 86400
                },
                {
                  "type": "null"
                }
              ]
            },
            "drift_ppm": {
              "oneOf": [
                {
                  "type": "number",
                  "minimum": -10000,
                  "maximum": 10000
                },
                {
                  "type": "null"
                }
              ]
            },
            "correction": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "kind",
                "rate_ratio"
              ],
              "properties": {
                "kind": {
                  "enum": [
                    "none",
                    "aresample"
                  ]
                },
                "rate_ratio": {
                  "oneOf": [
                    {
                      "type": "number",
                      "minimum": 0.99,
                      "maximum": 1.01
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              }
            },
            "residual_frames": {
              "oneOf": [
                {
                  "type": "null"
                },
                {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "start",
                    "middle",
                    "end"
                  ],
                  "properties": {
                    "start": {
                      "type": "number",
                      "minimum": 0
                    },
                    "middle": {
                      "type": "number",
                      "minimum": 0
                    },
                    "end": {
                      "type": "number",
                      "minimum": 0
                    }
                  }
                }
              ]
            },
            "windows": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "used",
                "consistent"
              ],
              "properties": {
                "used": {
                  "type": "integer",
                  "minimum": 0
                },
                "consistent": {
                  "type": "integer",
                  "minimum": 0
                }
              }
            },
            "reason": {
              "oneOf": [
                {
                  "$ref": "common.schema.json#/$defs/SyncReason"
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
                    "const": "sync_required"
                  }
                }
              },
              "then": {
                "properties": {
                  "method": {
                    "const": "none"
                  },
                  "offset_seconds": {
                    "type": "null"
                  },
                  "reason": {
                    "$ref": "common.schema.json#/$defs/SyncReason"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "status": {
                    "const": "synced"
                  }
                }
              },
              "then": {
                "properties": {
                  "method": {
                    "enum": [
                      "timecode",
                      "gcc_phat",
                      "manual"
                    ]
                  },
                  "offset_seconds": {
                    "type": "number"
                  },
                  "reason": {
                    "type": "null"
                  }
                }
              }
            },
            {
              "if": {
                "properties": {
                  "correction": {
                    "properties": {
                      "kind": {
                        "const": "aresample"
                      }
                    }
                  }
                }
              },
              "then": {
                "properties": {
                  "correction": {
                    "properties": {
                      "rate_ratio": {
                        "type": "number"
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      }
    }
  },
  "speaker-attribution.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/multi-speaker/v1/speaker-attribution.schema.json",
    "title": "speaker_attribution_v1",
    "description": "Speaker labels on the Whisper word timeline (SS7): each Whisper word takes the speaker whose diarization turn overlaps it most (ties: the earlier turn); a word without an overlapping turn takes the nearest turn within `max_gap_seconds`, else it stays unattributed (never guessed). Consecutive words of one speaker form a labelled turn with the inclusive word index range. `status: single_speaker` means the trigger did not fire and no diarization ran.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "status",
      "source",
      "speakers",
      "turns",
      "word_count",
      "unattributed_word_count"
    ],
    "properties": {
      "schema_version": {
        "const": "speaker_attribution_v1"
      },
      "status": {
        "enum": [
          "attributed",
          "single_speaker"
        ]
      },
      "source": {
        "$ref": "common.schema.json#/$defs/SourceRef"
      },
      "speakers": {
        "type": "array",
        "maxItems": 12,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/SpeakerLabel"
        }
      },
      "turns": {
        "type": "array",
        "maxItems": 50000,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "speaker",
            "start_seconds",
            "end_seconds",
            "first_word_index",
            "last_word_index"
          ],
          "properties": {
            "speaker": {
              "$ref": "common.schema.json#/$defs/SpeakerLabel"
            },
            "start_seconds": {
              "$ref": "common.schema.json#/$defs/Seconds"
            },
            "end_seconds": {
              "$ref": "common.schema.json#/$defs/Seconds"
            },
            "first_word_index": {
              "type": "integer",
              "minimum": 0
            },
            "last_word_index": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      },
      "word_count": {
        "type": "integer",
        "minimum": 0
      },
      "unattributed_word_count": {
        "type": "integer",
        "minimum": 0
      }
    },
    "allOf": [
      {
        "if": {
          "properties": {
            "status": {
              "const": "single_speaker"
            }
          }
        },
        "then": {
          "properties": {
            "speakers": {
              "maxItems": 0
            },
            "turns": {
              "maxItems": 0
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "attributed"
            }
          }
        },
        "then": {
          "properties": {
            "speakers": {
              "minItems": 1
            }
          }
        }
      }
    ]
  },
  "speaker-face-assignment.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/multi-speaker/v1/speaker-face-assignment.schema.json",
    "title": "speaker_face_assignment_v1",
    "description": "Diarization speakers matched to face tracks (SS7): the turn x face-track overlap matrix (mouth-motion score of each track while the speaker talks, normalized by the speaker's total turn time) and the deterministic best one-to-one assignment. A speaker whose score or margin to its runner-up face is below the rules threshold is low confidence; then exactly one question with a thumbnail moment is asked (the least confident speaker), never a guess presented as certain. `face_track_id` is null when no visible track matches.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "status",
      "speakers",
      "question"
    ],
    "properties": {
      "schema_version": {
        "const": "speaker_face_assignment_v1"
      },
      "status": {
        "description": "assigned = every speaker matched with high confidence; question_required = one low-confidence speaker is asked about; no_faces = no face track was visible while anyone spoke (layouts fall back to the full frame, nothing is asked).",
        "enum": [
          "assigned",
          "question_required",
          "no_faces"
        ]
      },
      "speakers": {
        "type": "array",
        "minItems": 1,
        "maxItems": 12,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "speaker",
            "face_track_id",
            "score",
            "margin",
            "confidence"
          ],
          "properties": {
            "speaker": {
              "$ref": "common.schema.json#/$defs/SpeakerLabel"
            },
            "face_track_id": {
              "oneOf": [
                {
                  "$ref": "common.schema.json#/$defs/FaceTrackId"
                },
                {
                  "type": "null"
                }
              ]
            },
            "score": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            "margin": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            "confidence": {
              "enum": [
                "high",
                "low"
              ]
            }
          }
        }
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
              "speaker",
              "candidate_face_track_ids",
              "sample_seconds"
            ],
            "properties": {
              "speaker": {
                "$ref": "common.schema.json#/$defs/SpeakerLabel"
              },
              "candidate_face_track_ids": {
                "type": "array",
                "minItems": 1,
                "maxItems": 4,
                "uniqueItems": true,
                "items": {
                  "$ref": "common.schema.json#/$defs/FaceTrackId"
                }
              },
              "sample_seconds": {
                "$ref": "common.schema.json#/$defs/Seconds"
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
            "status": {
              "const": "assigned"
            }
          }
        },
        "then": {
          "properties": {
            "question": {
              "type": "null"
            },
            "speakers": {
              "items": {
                "properties": {
                  "confidence": {
                    "const": "high"
                  }
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
              "const": "question_required"
            }
          }
        },
        "then": {
          "properties": {
            "question": {
              "type": "object"
            }
          }
        }
      },
      {
        "if": {
          "properties": {
            "status": {
              "const": "no_faces"
            }
          }
        },
        "then": {
          "properties": {
            "question": {
              "type": "null"
            },
            "speakers": {
              "items": {
                "properties": {
                  "face_track_id": {
                    "type": "null"
                  }
                }
              }
            }
          }
        }
      }
    ]
  },
  "speaker-shot-plan.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/multi-speaker/v1/speaker-shot-plan.schema.json",
    "title": "speaker_shot_plan_v1",
    "description": "Deterministic speaker shots for a multi-speaker edit (SS7 transition rules, multi-speaker-rules.json): shots never shorter than `min_shot_seconds` (2 s floor; a template cut_rhythm may only raise it), a new speaker is cut to `confirm_seconds` after their qualifying turn starts, speech under the reaction limit (< 0.8 s) never causes a cut, overlapping speech longer than 1 s becomes split (two speakers) or group (three or more), and a listener silent for 30 s gets a reaction shot. Shots tile [0, duration] without gaps or overlap. The layout of each shot (PresenterLayout) is chosen by the model; this plan only fixes who is on screen and when.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "rules_revision",
      "min_shot_seconds",
      "duration_seconds",
      "shots"
    ],
    "properties": {
      "schema_version": {
        "const": "speaker_shot_plan_v1"
      },
      "rules_revision": {
        "type": "integer",
        "minimum": 1
      },
      "min_shot_seconds": {
        "type": "number",
        "minimum": 2,
        "maximum": 60
      },
      "duration_seconds": {
        "type": "number",
        "exclusiveMinimum": 0,
        "maximum": 86400
      },
      "shots": {
        "type": "array",
        "minItems": 1,
        "maxItems": 20000,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "start_seconds",
            "end_seconds",
            "kind",
            "speakers",
            "face_track_ids"
          ],
          "properties": {
            "start_seconds": {
              "$ref": "common.schema.json#/$defs/Seconds"
            },
            "end_seconds": {
              "$ref": "common.schema.json#/$defs/Seconds"
            },
            "kind": {
              "$ref": "common.schema.json#/$defs/ShotKind"
            },
            "speakers": {
              "type": "array",
              "maxItems": 12,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/SpeakerLabel"
              }
            },
            "face_track_ids": {
              "type": "array",
              "maxItems": 12,
              "uniqueItems": true,
              "items": {
                "$ref": "common.schema.json#/$defs/FaceTrackId"
              }
            }
          }
        }
      }
    }
  },
  "speaker-turns.schema.json": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://youtorch.local/contracts/agentic-spark/multi-speaker/v1/speaker-turns.schema.json",
    "title": "speaker_turns_v1",
    "description": "Normalized speaker turns of one source from the diarization route (it runs only in addition to the Whisper transcript and only when the multi-speaker trigger fires). Turns come from per-word speaker indexes: consecutive words of one speaker separated by at most `merge_gap_seconds` form one turn. Labels are assigned in order of first speech (S1, S2, ...). Turns never carry text; the transcript text is always the Whisper transcript.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "schema_version",
      "source",
      "speakers",
      "turns"
    ],
    "properties": {
      "schema_version": {
        "const": "speaker_turns_v1"
      },
      "source": {
        "$ref": "common.schema.json#/$defs/SourceRef"
      },
      "speakers": {
        "type": "array",
        "minItems": 1,
        "maxItems": 12,
        "uniqueItems": true,
        "items": {
          "$ref": "common.schema.json#/$defs/SpeakerLabel"
        }
      },
      "turns": {
        "type": "array",
        "maxItems": 50000,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "speaker",
            "start_seconds",
            "end_seconds"
          ],
          "properties": {
            "speaker": {
              "$ref": "common.schema.json#/$defs/SpeakerLabel"
            },
            "start_seconds": {
              "$ref": "common.schema.json#/$defs/Seconds"
            },
            "end_seconds": {
              "$ref": "common.schema.json#/$defs/Seconds"
            }
          }
        }
      }
    }
  }
} as const;

export const DOCUMENT_TYPES = ["media-sync-result", "speaker-attribution", "speaker-face-assignment", "speaker-shot-plan", "speaker-turns"] as const;
export type DocumentType = "media-sync-result" | "speaker-attribution" | "speaker-face-assignment" | "speaker-shot-plan" | "speaker-turns";

export const SCHEMA_VERSIONS: Readonly<Record<string, readonly (string | number)[]>> = {
  "media-sync-result": [
    "media_sync_result_v1"
  ],
  "speaker-attribution": [
    "speaker_attribution_v1"
  ],
  "speaker-face-assignment": [
    "speaker_face_assignment_v1"
  ],
  "speaker-shot-plan": [
    "speaker_shot_plan_v1"
  ],
  "speaker-turns": [
    "speaker_turns_v1"
  ]
};

export const SAFE_DICTIONARY: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
  "media-sync-result": {
    "status": [
      "sync_required",
      "synced"
    ]
  },
  "speaker-attribution": {
    "status": [
      "attributed",
      "single_speaker"
    ]
  },
  "speaker-face-assignment": {
    "status": [
      "assigned",
      "no_faces",
      "question_required"
    ]
  }
};

export type MediaSyncResult = {
    readonly "schema_version": "media_sync_result_v1";
    readonly "status": "synced" | "sync_required";
    readonly "reference": unknown;
    readonly "frame_rate": {
    readonly "num": number;
    readonly "den": number;
  };
    readonly "sources": readonly ({
    readonly "source": unknown;
    readonly "status": "synced" | "sync_required";
    readonly "method": "timecode" | "gcc_phat" | "manual" | "none";
    readonly "offset_seconds": (number) | (null);
    readonly "drift_ppm": (number) | (null);
    readonly "correction": {
    readonly "kind": "none" | "aresample";
    readonly "rate_ratio": (number) | (null);
  };
    readonly "residual_frames": (null) | ({
    readonly "start": number;
    readonly "middle": number;
    readonly "end": number;
  });
    readonly "windows": {
    readonly "used": number;
    readonly "consistent": number;
  };
    readonly "reason": ("no_common_audio" | "too_few_consistent_windows" | "drift_unfit" | "no_audio_stream") | (null);
  })[];
  };
export type SpeakerAttribution = {
    readonly "schema_version": "speaker_attribution_v1";
    readonly "status": "attributed" | "single_speaker";
    readonly "source": unknown;
    readonly "speakers": readonly (string)[];
    readonly "turns": readonly ({
    readonly "speaker": string;
    readonly "start_seconds": number;
    readonly "end_seconds": number;
    readonly "first_word_index": number;
    readonly "last_word_index": number;
  })[];
    readonly "word_count": number;
    readonly "unattributed_word_count": number;
  };
export type SpeakerFaceAssignment = {
    readonly "schema_version": "speaker_face_assignment_v1";
    readonly "status": "assigned" | "question_required" | "no_faces";
    readonly "speakers": readonly ({
    readonly "speaker": string;
    readonly "face_track_id": (number) | (null);
    readonly "score": number;
    readonly "margin": number;
    readonly "confidence": "high" | "low";
  })[];
    readonly "question": (null) | ({
    readonly "speaker": string;
    readonly "candidate_face_track_ids": readonly (number)[];
    readonly "sample_seconds": number;
  });
  };
export type SpeakerShotPlan = {
    readonly "schema_version": "speaker_shot_plan_v1";
    readonly "rules_revision": number;
    readonly "min_shot_seconds": number;
    readonly "duration_seconds": number;
    readonly "shots": readonly ({
    readonly "start_seconds": number;
    readonly "end_seconds": number;
    readonly "kind": "single" | "split" | "group" | "reaction";
    readonly "speakers": readonly (string)[];
    readonly "face_track_ids": readonly (number)[];
  })[];
  };
export type SpeakerTurns = {
    readonly "schema_version": "speaker_turns_v1";
    readonly "source": unknown;
    readonly "speakers": readonly (string)[];
    readonly "turns": readonly ({
    readonly "speaker": string;
    readonly "start_seconds": number;
    readonly "end_seconds": number;
  })[];
  };

export const reader = new ContractPackageReader({
  package: "multi-speaker",
  schemas: SCHEMAS as unknown as Record<string, object>,
  documentTypes: DOCUMENT_TYPES as unknown as readonly string[],
  schemaVersions: SCHEMA_VERSIONS,
  safeDictionary: SAFE_DICTIONARY,
});

export function read(document: DocumentType, payload: unknown) {
  return reader.read(document, payload);
}
