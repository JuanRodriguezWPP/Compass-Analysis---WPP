/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Observable } from 'rxjs';

/** Supported video aspect ratios. */
export type FormatType = '16:9' | '9:16' | '1:1' | '3:4' | '4:3';
/** Supported audio overlay types. */
export type OverlayType =
  | 'variant_start'
  | 'variant_end'
  | 'video_start'
  | 'video_end';
/** Supported ABCD business objective types. */
export type AbcdType = 'awareness' | 'consideration' | 'action' | 'shorts';
/** Represents an ABCD business objective configuration. */
export type AbcdBusinessObjective = {
  displayName: string;
  value: string;
  promptPart: string;
};
/** Map of ABCD business objectives. */
export type AbcdBusinessObjectives = Map<AbcdType, AbcdBusinessObjective>;

/** Brand and client configuration parameters for prompt personalization. */
export interface BrandParams {
  /** Commercial name of the brand (e.g., "Coca-Cola") */
  brandName: string;
  /** Legal or commercial name of the advertiser (e.g., "The Coca-Cola Company") */
  advertiserName: string;
  /** Target country or market (e.g., "Mexico", "Global") */
  country?: string;
  /** Primary brand color in hex format (e.g., "#FF0000") */
  brandColor: string;
  /** Secondary brand color in hex format (e.g., "#00FF00") */
  brandColor2?: string;
  /** Tertiary brand color in hex format (e.g., "#0000FF") */
  brandColor3?: string;
  /** Communication tone guidelines (e.g., "Inspiring and close, avoid formal language") */
  communicationTone: string;
}

/** Settings for generating video variants. */
export interface GenerationSettings {
  prompt: string;
  evalPrompt: string;
  duration: number;
  demandGenAssets: boolean;
  shortenVideo: boolean;
  /** Flag to indicate if we are analyzing the full original video instead of generating variants. */
  fullVideoAnalysis?: boolean;
  /** Optional brand parameters injected into generation prompts. */
  brandParams?: BrandParams;
}

/** Represents an audio/video segment. */
export interface AvSegment {
  av_segment_id: string;
  start_s: number;
  end_s: number;
  selected?: boolean;
  splitting?: boolean;
  played?: boolean;
  segment_screenshot_uri?: string;
  segment_uri?: string;
}

/** Response structure for variant generation. */
export interface GenerateVariantsResponse {
  combo_id: number;
  title: string;
  scenes: string[];
  av_segments: AvSegment[];
  description: string;
  score: number;
  abcd: {
    attention: string;
    branding: string;
    connection: string;
    direction: string;
  };
  duration: string;
  variants?: VariantFormats;
  render_settings?: RenderSettings;
  images?: VariantImageAssets;
  texts?: VariantTextAsset[];
  original_format?: FormatType;
  strengths?: string[];
  weaknesses?: string[];
}

/** Response structure for YouTube Content Ideas. */
export interface YoutubeIdeaItem {
  title: string;
  description: string;
  video_prompt?: string;
}

/** A single creative idea for a geo zone */
export interface GeoZoneIdea {
  title: string;
  description: string;
  video_prompt?: string;
}

/** A geographic audience cluster zone */
export interface GeoZoneAudiencia {
  id_cluster: string;
  descripcion: string;
  coordenadas_asociadas: string[];
  sitios_aledanos: string[];
  perfil_audiencia_sugerido: string;
  ganchos_creativos_ctv: string[];
  ideas: GeoZoneIdea[];
}

/** Top-level geokey insights returned by Gemini */
export interface GeoKeyInsights {
  pais: string;
  ciudad: string;
  estrategia_geotargeting: string;
  zonas_de_audiencia: GeoZoneAudiencia[];
}

export interface YoutubeIdeasResponse {
  creative_services_script: string;
  wpp_open_prompt_json: any;
  relevant_frame_segment_indices: number[];
  insights: {
    ideas: YoutubeIdeaItem[];
    /** Per-category: key = category name, value = array of 3 ideas */
    categoryIdeas?: Record<string, YoutubeIdeaItem[]>;
    /** Per-geozone: structured geographic clustering with 3 ideas per zone */
    geoKeyInsights?: GeoKeyInsights;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPASS DATA — Mega JSON que orquesta el pipeline de análisis de 7 pasos
// ─────────────────────────────────────────────────────────────────────────────

export interface CompassGeoOportunidad {
  zona: string;
  audiencia: number;
  coordenada_central: string;
  estrategia: string;
  prioridad: number;
}

export interface CompassCategoriaContexto {
  categoria: string;
  afinidad: string;
  insights: string[];
  evidencias: string[];
  recomendaciones: string[];
}

export interface CompassOportunidad {
  titulo: string;
  evidencia: string;
  impacto: 'Alto' | 'Medio' | 'Bajo';
  prioridad: number;
  recomendacion: string;
}

export interface CompassData {
  meta: {
    brand: string;
    campaign: string;
    country: string;
    objective: string;
    date: string;
    video_name: string;
    video_duration: string;
    internal_ref: string;
  };
  contexto_campania: {
    nombre_campania: string;
    objetivo_negocio: string;
    audiencia: string;
    tono: string;
    descripcion: string;
    lineamientos_marca: string;
    consideraciones: string;
    contexto_mercado: string;
  };
  evaluacion_creativa: {
    score: number;
    score_max: number;
    score_label: string;
    abcd: {
      attention: string;
      branding: string;
      connection: string;
      direction: string;
    };
    strengths: string[];
    weaknesses: string[];
    descripcion: string;
  } | null;
  geo_intelligence: {
    macro_estrategias: CompassGeoOportunidad[];
    micro_oportunidades: CompassGeoOportunidad[];
  } | null;
  channel_intelligence: {
    pregunta: string;
    contextos: CompassCategoriaContexto[];
  } | null;
  prioridades: {
    pregunta: string;
    oportunidades: CompassOportunidad[];
  } | null;
}

/** Response structure for fetching previous runs. */
export interface PreviousRunsResponse {
  encodedUserId: string;
  runs: string[];
}

/** Represents a previously rendered video set. */
export interface PreviousRender {
  value: string;
  displayName: string;
}

/** Settings for rendering a video variant. */
export interface RenderSettings {
  generate_image_assets: boolean;
  generate_text_assets: boolean;
  formats: FormatType[];
  use_music_overlay: boolean;
  use_continuous_audio: boolean;
  fade_out: boolean;
  overlay_type?: OverlayType;
  use_blanking_fill?: boolean;
}

/** Represents the queue of variants to be rendered. */
export interface RenderQueue {
  queue: RenderQueueVariant[];
  queueName: string;
  previewAnalyses: Record<string, unknown>;
  sourceDimensions: { w: number; h: number };
}

/** Represents a variant in the render queue. */
export interface RenderQueueVariant {
  original_variant_id: number;
  av_segments: AvSegment[];
  title: string;
  description: string;
  score: number;
  abcd: {
    attention: string;
    branding: string;
    connection: string;
    direction: string;
  };
  render_settings: RenderSettings;
  duration: string;
  userSelection: boolean;
  scenes: string;
}

/** Represents the approval status of an entity. */
export interface EntityApproval {
  entity: string;
  approved: boolean;
}

/** Map of format types to their approval status. */
export interface VariantFormats {
  '16:9'?: EntityApproval;
  '9:16'?: EntityApproval;
  '1:1'?: EntityApproval;
  '3:4'?: EntityApproval;
  '4:3'?: EntityApproval;
  [key: string]: EntityApproval | undefined;
}

/** Map of format types to their image assets. */
export interface VariantImageAssets {
  '16:9'?: EntityApproval[];
  '9:16'?: EntityApproval[];
  '1:1'?: EntityApproval[];
  '3:4'?: EntityApproval[];
  '4:3'?: EntityApproval[];
  [key: string]: EntityApproval[] | undefined;
}

/** Represents a text asset. */
export interface VariantTextAsset {
  headline: string;
  description: string;
  approved?: boolean;
  editable?: boolean;
}

/** Represents a fully rendered variant. */
export interface RenderedVariant {
  variant_id: number;
  av_segments: Record<string, AvSegment>;
  title: string;
  description: string;
  score: number;
  abcd: {
    attention: string;
    branding: string;
    connection: string;
    direction: string;
  };
  variants?: VariantFormats;
  duration: string;
  scenes: string;
  render_settings: RenderSettings;
  images?: VariantImageAssets;
  texts?: VariantTextAsset[];
  original_format?: FormatType;
}

/** Response structure for preview generation. */
export interface GeneratePreviewsResponse {
  square?: string;
  vertical?: string;
  '16:9'?: string;
  '9:16'?: string;
  '1:1'?: string;
  '3:4'?: string;
  '4:3'?: string;
}

/** Weights used for preview generation. */
export interface PreviewWeights {
  text: number;
  face: number;
  objects: {
    person: number;
  };
}

/** Settings for preview generation. */
export interface PreviewSettings {
  sourceDimensions: { w: number; h: number };
  weights: PreviewWeights;
}

/** Represents a marker for segment splitting. */
export interface SegmentMarker {
  av_segment_id: string;
  marker_cut_time_s: number;
  canvas_position: number;
}

/** Interface for API calls service. */
export interface ApiCalls {
  /** Uploads a video file to the server. */
  uploadVideo(
    file: Blob,
    analyseAudio: boolean,
    encodedUserId: string
  ): Observable<string[]>;
  /** Loads a previous run from the given folder. */
  loadPreviousRun(folder: string): string[];
  /** Deletes a GCS folder. */
  deleteGcsFolder(folder: string): void;
  /** Fetches a file from GCS. */
  getFromGcs(
    url: string,
    retryDelay?: number,
    maxRetries?: number
  ): Observable<string>;
  /** Generates variants based on the provided settings. */
  generateVariants(
    gcsFolder: string,
    settings: GenerationSettings
  ): Observable<GenerateVariantsResponse[]>;
  /** Generates previews for the given segments. */
  generatePreviews(
    gcsFolder: string,
    analysis: any,
    segments: AvSegment[],
    settings: PreviewSettings
  ): Observable<GeneratePreviewsResponse>;
  /** Gets the list of previous runs from GCS. */
  getRunsFromGcs(): Observable<PreviousRunsResponse>;
  /** Gets the list of renders from a GCS folder. */
  getRendersFromGcs(gcsFolder: string): Observable<string[]>;
  /** Renders the variants in the queue. */
  renderVariants(
    gcsFolder: string,
    renderQueue: RenderQueue
  ): Observable<string>;
  /** Gets the full GCS folder path. */
  getGcsFolderPath(folder: string): Observable<string>;
  /** Gets the web app URL. */
  getWebAppUrl(): Observable<string>;
  /** Regenerates a text asset. */
  regenerateTextAsset(
    variantVideoPath: string,
    textAsset: VariantTextAsset,
    textAssetLanguage: string
  ): Observable<VariantTextAsset>;
  /** Stores the approval status of the variants. */
  storeApprovalStatus(
    gcsFolder: string,
    combos: RenderedVariant[]
  ): Observable<boolean>;
  /** Gets the language of the video. */
  getVideoLanguage(gcsFolder: string): Observable<string>;
  /** Generates text assets for the video. */
  generateTextAssets(
    variantVideoPath: string,
    textAssetsLanguage: string
  ): Observable<VariantTextAsset[]>;
  /** Splits a segment based on markers. */
  splitSegment(
    gcsFolder: string,
    segmentMarkers: SegmentMarker[]
  ): Observable<string>;
  updateTranscription(
    gcsFolder: string,
    transcriptionText: string
  ): Observable<boolean>;
  generateYoutubeIdeas(
    gcsFolder: string,
    abcdType: string,
    customPoints: string,
    mode: string,
    selectedValue: string,
    selectedCategories?: string[],
    macroJson?: string,
    microJson?: string
  ): Observable<string>;
  sendInsightsReport(payload: object): Observable<string>;
  generateGeoIntelligence(
    compassContextJson: string,
    macroJson: string,
    microJson: string
  ): Observable<string>;
  generateChannelIntelligence(
    compassContextJson: string,
    categories: string[]
  ): Observable<string>;
  generatePrioritization(compassContextJson: string): Observable<string>;
}
