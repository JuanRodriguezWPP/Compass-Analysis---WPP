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

import { CdkDrag } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import {
  MatButtonToggleGroup,
  MatButtonToggleModule,
} from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import {
  MatExpansionModule,
  MatExpansionPanel,
} from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import {
  MatSlideToggle,
  MatSlideToggleModule,
} from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../environments/environment';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { marked } from 'marked';
import { CONFIG } from '../../../config';
import { StringUtil } from '../../../string-util';
import { TimeUtil } from '../../../time-util';
import { HttpClient } from '@angular/common/http';
import * as echarts from 'echarts';
import * as Papa from 'papaparse';
declare const h3: any;
declare const maplibregl: any;
declare const deck: any;
import { ApiCallsService } from './api-calls/api-calls.service';
import {
  AbcdType,
  AvSegment,
  BrandParams,
  CompassData,
  FormatType,
  GenerateVariantsResponse,
  YoutubeIdeasResponse,
  OverlayType,
  PreviousRender,
  RenderedVariant,
  RenderQueueVariant,
  RenderSettings,
  SegmentMarker,
  VariantTextAsset,
} from './api-calls/api-calls.service.interface';
import { FileChooserComponent } from './file-chooser/file-chooser.component';
import { SmartFramingDialog } from './framing-dialog/framing-dialog.component';
import { SegmentsListComponent } from './segments-list/segments-list.component';
import { VideoComboComponent } from './video-combo/video-combo.component';

type ProcessStatus = 'hourglass_top' | 'pending' | 'check_circle';

export type FramingDialogData = {
  weightsPersonFaceIndex: number;
  weightsTextIndex: number;
  weightSteps: number[];
};

interface VideoFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  time: number;
}

interface VideoObject {
  name: string;
  start: number;
  end: number;
  frames: VideoFrame[];
}

interface NormalizedBoundingBox {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

interface FrameAnnotation {
  normalized_bounding_box: NormalizedBoundingBox;
  time_offset: string;
}

interface SegmentAnnotation {
  start_time_offset: string;
  end_time_offset: string;
}

interface EntityAnnotation {
  description: string;
}

interface ObjectAnnotation {
  entity: EntityAnnotation;
  segment: SegmentAnnotation;
  frames: FrameAnnotation[];
  confidence: number;
}

interface AnnotationResult {
  object_annotations: ObjectAnnotation[];
}

interface VideoAnalysisJson {
  annotation_results: AnnotationResult[];
}

interface RawVariant {
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
  render_settings: RenderSettings;
  variants: Record<FormatType, string>;
  images?: Record<FormatType, string[]>;
  texts?: VariantTextAsset[];
}

const ASPECT_RATIOS = {
  '1:1': 1,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
};
const ASPECT_RATIO_TOLERANCE = 0.12;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FileChooserComponent,
    MatButtonModule,
    MatDividerModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTabsModule,
    MatToolbarModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatIconModule,
    MatButtonToggleModule,
    SegmentsListComponent,
    VideoComboComponent,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatBadgeModule,
    MatSliderModule,
    MatSidenavModule,
    MatCardModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatStepperModule,
    CdkDrag,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  h3MapData: any[] | null = null;
  geoChartInstance: echarts.ECharts | undefined;
  categoryChartInstance: echarts.ECharts | undefined;
  loading = false;
  
  aiSummaryJson = '';
  activeGeoView: 'map' | 'ai' | 'micro' = 'map';
  microOpportunitiesJson = '';
  mapInstance: any = null;
  deckOverlay: any = null;

  // ── Compass Pipeline State ──────────────────────────────────────────────────
  compassData: CompassData | null = null;
  compassJson = '';
  compassStepError = '';

  get hasGeoData(): boolean {
    return this.aiSummaryJson.length > 0;
  }

  get hasChannelData(): boolean {
    return this.curatedChannels.length > 0;
  }
  // ────────────────────────────────────────────────────────────────────────────
  generatingVariants = false;
  rendering = false;
  loadingVariant = false;
  generatingPreviews = false;
  selectedFile?: File;
  videoPath?: string;
  analysisJson?: VideoAnalysisJson;
  activeVideoObjects?: VideoObject[];
  videoObjects?: VideoObject[];
  squareVideoObjects?: VideoObject[];
  verticalVideoObjects?: VideoObject[];
  previewAnalyses: Record<string, VideoObject[]> = {};
  combosJson?: unknown;
  combos?: RenderedVariant[];
  originalCombos?: RenderedVariant[];
  originalAvSegments?: AvSegment[];
  avSegments?: AvSegment[];
  variants?: GenerateVariantsResponse[];
  fullVideoEvaluationResult?: GenerateVariantsResponse;
  selectedVariant = 0;
  transcriptStatus: ProcessStatus = 'hourglass_top';
  analysisStatus: ProcessStatus = 'hourglass_top';
  combinationStatus: ProcessStatus = 'hourglass_top';
  segmentsStatus: ProcessStatus = 'hourglass_top';
  canvas?: CanvasRenderingContext2D;
  frameInterval?: number;
  transcript?: string;
  currentSegmentId?: number;

  // ── Compass Configuration fields ───────────────────────────────────────────
  // Section 1
  brandName = '';
  campaignName = '';
  country = '';
  advertiserName = '';
  activationDate = '';
  internalReference = '';

  // Section 2
  campaignObjective = '';
  businessObjective = '';
  targetAudience = '';
  communicationTone = '';
  campaignDescription = '';
  brandGuidelines = '';
  specialConsiderations = '';
  brandColor = '';
  brandColor2 = '';
  brandColor3 = '';

  // Section 3
  geoCsvSummary = '';
  geoCsvLineCount = 0;
  geoCsvBase64 = '';
  curatedChannels: string[] = [];

  toggleCuratedChannel(cat: string, checked: boolean) {
    if (checked) {
      if (!this.curatedChannels.includes(cat)) {
        this.curatedChannels.push(cat);
      }
    } else {
      this.curatedChannels = this.curatedChannels.filter(c => c !== cat);
    }
  }

  onGeoCsvSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      // 1. Leer como texto para la IA
      const textReader = new FileReader();
      textReader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          this.youtubeGeoCoordinates = text;
        }
      };
      textReader.readAsText(file);

      // 2. Leer como base64 (para archivo adjunto)
      const b64Reader = new FileReader();
      b64Reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        this.geoCsvBase64 = dataUrl.split(',')[1] || '';
      };
      b64Reader.onerror = () => {
        this.snackBar.open('Error al leer el archivo CSV.', 'Cerrar', { duration: 3000 });
      };
      b64Reader.readAsDataURL(file);

      // 3. Procesar y Agrupar con PapaParse y H3
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data;
          this.geoCsvLineCount = data.length;

          // Agrupar por geokey (Para el Mapa) y por Municipio (Para la IA)
          const h3Map = new Map<string, { adultos: number, estado: string, municipio: string }>();
          const aiMap = new Map<string, { estado: string, municipio: string, adultos: number }>();

          data.forEach((row: any) => {
            const key = row['geokey'];
            const adultos = parseInt(row['geokeys_adults'], 10) || 0;
            const estado = row['geolookup_Estado'] || 'Desconocido';
            const municipio = row['geolookup_Municipio'] || 'Desconocido';

            // Agrupación H3
            if (key) {
              const existing = h3Map.get(key);
              if (existing) {
                 existing.adultos += adultos;
              } else {
                 h3Map.set(key, { adultos, estado, municipio });
              }
            }

            // Agrupación IA (Estado + Municipio)
            if (estado !== 'Desconocido' && municipio !== 'Desconocido') {
              const aiKey = `${estado}-${municipio}`;
              if (aiMap.has(aiKey)) {
                aiMap.get(aiKey)!.adultos += adultos;
              } else {
                aiMap.set(aiKey, { estado, municipio, adultos });
              }
            }
          });

          // Obtener bordes para todas las agrupaciones
          const demoResults: any[] = [];
          for (const [key, value] of h3Map.entries()) {
              let boundaries: number[][] = [];
              try {
                // cellToBoundary devuelve un array de [lat, lng]
                boundaries = h3.cellToBoundary(key);
              } catch (e) {
                console.warn("H3 inválido:", key);
              }

              demoResults.push({
                h3_id: key,
                total_adults: value.adultos,
                estado: value.estado,
                municipio: value.municipio,
                boundaries_demo: boundaries
              });
          }

          // Mostrar resultado en la pantalla (todas las agrupaciones como pediste)
          this.geoCsvSummary = JSON.stringify({
            status: "Procesamiento completado con éxito",
            total_filas_leidas: data.length,
            hexagonos_h3_unicos: h3Map.size,
            muestra_de_datos_agrupados: demoResults // Muestra todas
          }, null, 2);
          
          // Generar el paquete para la Inteligencia Artificial (Top 100 Zonas)
          const aiArray = Array.from(aiMap.values());
          aiArray.sort((a, b) => b.adultos - a.adultos); // Ordenar de mayor a menor demanda
          const top100Zonas = aiArray.slice(0, 100); // Quedarnos con el Top 100

          this.aiSummaryJson = JSON.stringify({
            contexto_estrategico: "Ranking de concentración de audiencia objetivo",
            top_zonas_demanda: top100Zonas
          }, null, 2);

          // Generar el paquete para Micro Oportunidades (Agrupación por cercanía)
          const h3Array = Array.from(h3Map.entries()).map(([id, val]) => ({ id, adultos: val.adultos, estado: val.estado, municipio: val.municipio }));
          h3Array.sort((a, b) => b.adultos - a.adultos);
          
          const clusters: any[] = [];
          for (const hex of h3Array) {
            let added = false;
            for (const cluster of clusters) {
              let distance = Infinity;
              try {
                // h3-js v4: gridDistance calcula la distancia en anillos (0 = el mismo, 1 = vecinos, 2 = vecinos de vecinos)
                distance = h3.gridDistance(hex.id, cluster.center_id);
              } catch (e) {
                // Si la función falla (ej. hexágonos en diferentes caras del icosaedro o muy lejanos), la distancia se queda en Infinity
              }
              if (distance <= 2) { 
                cluster.adultos_totales += hex.adultos;
                cluster.hexagons.push(hex.id);
                added = true;
                break;
              }
            }
            if (!added) {
              clusters.push({
                center_id: hex.id,
                adultos_totales: hex.adultos,
                estado: hex.estado,
                municipio: hex.municipio,
                hexagons: [hex.id]
              });
            }
          }

          // Ordenar los clusters formados de mayor a menor y extraer el Top 20
          clusters.sort((a, b) => b.adultos_totales - a.adultos_totales);
          const top20Clusters = clusters.slice(0, 20).map(cluster => {
            try {
              const boundaries = h3.cellToBoundary(cluster.center_id);
              const [lat, lng] = h3.cellToLatLng(cluster.center_id);
              return {
                id_centro: cluster.center_id,
                audiencia_concentrada: cluster.adultos_totales,
                estado: cluster.estado,
                municipio: cluster.municipio,
                cantidad_poligonos_agrupados: cluster.hexagons.length,
                coordenada_central: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                poligono_central: boundaries
              };
            } catch (e) {
              return { id_centro: cluster.center_id, audiencia_concentrada: cluster.adultos_totales, error: "H3 inválido" };
            }
          });

          this.microOpportunitiesJson = JSON.stringify({
            contexto_estrategico: "Micro Oportunidades - Top 20 clústeres hiper-concentrados (Agrupados por cercanía de hasta 2 anillos)",
            top_zonas_micro: top20Clusters
          }, null, 2);

          // Guardar la data completa para el mapa
          this.h3MapData = demoResults.map((d: any) => ({
            h3_id: d.h3_id,
            value: d.total_adults,
            estado: d.estado,
            municipio: d.municipio,
            boundaries: d.boundaries_demo
          }));
          
          this.cdRef.detectChanges();
          
          // Redibujar el mapa si estamos en la pestaña Geo
          if (this.activeDashboardTab === 'geo') {
            setTimeout(() => this.initGeoMap(), 100);
          }
        }
      });
    }
  }
  marketContext = '';

  // Accordion State
  openSection = 1;

  get section1Complete(): boolean {
    return !!(this.brandName && this.campaignName && this.country && this.advertiserName && this.activationDate);
  }

  get section2Complete(): boolean {
    return this.section1Complete && !!(this.campaignObjective && this.businessObjective && this.targetAudience && this.communicationTone && this.campaignDescription);
  }

  get totalMandatoryFields(): number {
    return 11;
  }

  get completedMandatoryFieldsCount(): number {
    let count = 0;
    if (this.brandName) count++;
    if (this.campaignName) count++;
    if (this.country) count++;
    if (this.advertiserName) count++;
    if (this.activationDate) count++;
    if (this.campaignObjective) count++;
    if (this.businessObjective) count++;
    if (this.targetAudience) count++;
    if (this.communicationTone) count++;
    if (this.campaignDescription) count++;
    if (this.selectedFile || this.selectedHistoryRun) count++;
    return count;
  }

  get section1Status(): 'complete' | 'progress' {
    return this.section1Complete ? 'complete' : 'progress';
  }

  get section2Status(): 'complete' | 'progress' | 'locked' {
    if (!this.section1Complete) return 'locked';
    return this.section2Complete ? 'complete' : 'progress';
  }

  toggleSection(section: number) {
    if (section === 2 && !this.section1Complete) return;
    if (section === 3 && !this.section2Complete) return;
    if (section === 4 && !this.section2Complete) return;
    this.openSection = this.openSection === section ? 0 : section;
  }

  goToSection(section: number) {
    this.openSection = section;
  }
  // ────────────────────────────────────────────────────────────────────────────

  prompt = 'Generate a shorter version of the video, keeping the core message the same.';
  defaultPrompt = 'Generate a shorter version of the video, keeping the core message the same.';

  selectedFullVideoObjective = 'general';
  analyzingFullVideo = false;
  fullVideoObjectives = [
    { value: 'general', label: 'General', description: 'Evalúa el rendimiento global sin métricas específicas.' },
    { value: 'awareness', label: 'Reconocimiento (Awareness)', description: 'Evalúa si el video capta la atención rápidamente y posiciona la marca.' },
    { value: 'consideration', label: 'Consideración', description: 'Evalúa si el video explica el producto y fomenta la retención de información.' },
    { value: 'action', label: 'Acción', description: 'Evalúa si el video persuade al espectador a realizar una compra o clic.' },
    { value: 'engagement', label: 'Interacción (Engagement)', description: 'Evalúa si el video incentiva "likes", comentarios y que sea compartido.' }
  ];

  getFullVideoObjectiveLabel(): string {
    const obj = this.fullVideoObjectives.find(o => o.value === this.selectedFullVideoObjective);
    return obj ? obj.label : '';
  }

  /** Returns the max possible score for the currently selected objective */
  getMaxScore(): number {
    const maxScores: Record<string, number> = {
      awareness: 15,
      consideration: 15,
      action: 18,
      engagement: 20,
      general: 20,
    };
    return maxScores[this.selectedFullVideoObjective] ?? 17;
  }

  /** Returns a label based on score vs max */
  getScoreLabel(score: number): string {
    const max = this.getMaxScore();
    const ratio = score / max;
    if (ratio >= 0.82) return 'Excelente potencial';
    if (ratio >= 0.65) return 'Buen potencial';
    if (ratio >= 0.47) return 'Potencial regular';
    return 'Bajo potencial';
  }

  /** Returns CSS color for a score */
  getScoreColor(score: number): string {
    const max = this.getMaxScore();
    const ratio = score / max;
    if (ratio >= 0.82) return '#1a73e8';
    if (ratio >= 0.65) return '#188038';
    if (ratio >= 0.47) return '#f29900';
    return '#d93025';
  }

  selectedPromptOption = 'default';
  predefinedPrompts = [
    { value: 'default', label: 'Por Defecto', text: 'Maintain the core narrative arc while condensing the runtime. Ensure all primary product features and brand messaging are preserved. Smoothly transition between essential scenes to deliver a cohesive, impact-driven summary.' },
    { value: 'highlight', label: 'Resaltar Puntos Clave', text: 'Extract and sequence only the highest-impact moments. Focus strictly on key value propositions, product reveals, and critical calls-to-action. Discard any filler content or B-roll that does not directly support the primary message.' },
    { value: 'engaging', label: 'Más Atractivo', text: 'Maximize viewer retention by prioritizing high-energy, visually dynamic scenes. Hook the viewer in the first 3 seconds, maintain rapid pacing, and ensure an emotional or exciting peak before the final call-to-action.' },
    { value: 'professional', label: 'Resumen Profesional', text: 'Assemble a polished, corporate-ready summary. Prioritize scenes with formal narration, data points, or executive presence. Ensure the tone remains authoritative and trustworthy, avoiding overly casual edits.' },
    { value: 'social', label: 'Redes Sociales', text: 'Optimize strictly for short-form social media (Youtube, Reels). Rules:\\n1) Start with an immediate, disruptive hook.\\n2) Keep pacing fast to prevent scrolling.\\n3) Focus on visually striking elements and clear CTAs.' },
    { value: 'crop-only', label: 'Solo Recorte (Sin Acortar)', text: 'Perform intelligent reframing to adapt the aspect ratio without altering the original timeline or omitting any scenes. Ensure the primary subjects remain centered and visible in the new frame.' },
    { value: 'custom', label: 'Prompt Personalizado', text: '' }
  ];
  /** Base prompt texts before brand context injection — used by onPromptSelectionChange() */
  private readonly basePredefinedPrompts = [
    { value: 'default', text: 'Maintain the core narrative arc while condensing the runtime. Ensure all primary product features and brand messaging are preserved. Smoothly transition between essential scenes to deliver a cohesive, impact-driven summary.' },
    { value: 'highlight', text: 'Extract and sequence only the highest-impact moments. Focus strictly on key value propositions, product reveals, and critical calls-to-action. Discard any filler content or B-roll that does not directly support the primary message.' },
    { value: 'engaging', text: 'Maximize viewer retention by prioritizing high-energy, visually dynamic scenes. Hook the viewer in the first 3 seconds, maintain rapid pacing, and ensure an emotional or exciting peak before the final call-to-action.' },
    { value: 'professional', text: 'Assemble a polished, corporate-ready summary. Prioritize scenes with formal narration, data points, or executive presence. Ensure the tone remains authoritative and trustworthy, avoiding overly casual edits.' },
    { value: 'social', text: 'Optimize strictly for short-form social media (Youtube Shorts). Rules:\\n1) Start with an immediate, disruptive hook.\\n2) Keep pacing fast to prevent scrolling.\\n3) Focus on visually striking elements and clear CTAs.' },
    { value: 'crop-only', text: 'Perform intelligent reframing to adapt the aspect ratio without altering the original timeline or omitting any scenes. Ensure the primary subjects remain centered and visible in the new frame.' },
    { value: 'custom', text: '' },
  ];
  isCustomPrompt = false;
  selectedAbcdType: AbcdType = 'awareness';
  evalPrompt = CONFIG.vertexAi.abcdBusinessObjectives.awareness.promptPart;

  // YouTube Content Ideas Generator State
  youtubeCustomPoints = '';
  youtubePersonalizationMode: 'category' | 'geokey' | null = null;
  
  // Script loading flag
  mapScriptsLoaded = false;
  youtubeSelectedValue = '';
  youtubeSelectedCategories: string[] = [];
  youtubeGeoCoordinates = '';
  youtubeIdeasResponse: YoutubeIdeasResponse | null = null;
  relevantScreenshots: string[] = [];
  carouselIndex = 0;
  isGeneratingYoutubeIdeas = false;

  readonly youtubeCategories = [
    'Cine/Animación', 'Autos/Vehículos', 'Música', 'Mascotas/Animales', 
    'Deportes', 'Cortometrajes', 'Viajes/Eventos', 'Videojuegos', 'Videoblogs', 
    'Personas/Blogs', 'Comedia', 'Entretenimiento', 'Noticias/Política', 
    'Tutoriales/Estilo', 'Educación', 'Ciencia/Tecnología', 'Películas', 
    'Anime/Animación', 'Acción/Aventura', 'Clásicos', 'Documentales', 'Drama', 
    'Familia', 'Extranjero', 'Terror', 'Ciencia Ficción/Fantasía', 'Suspenso', 
    'Cortos', 'Programas', 'Tráilers'
  ];

  duration = 0;
  step = 0;
  shortenVideo = true;
  audioSettings = 'segment';
  overlaySettings: OverlayType = 'variant_start';
  fadeOut = false;
  useBlankingFill = false;
  demandGenAssets = true;
  analyseAudio = false;
  previousRuns: string[] | undefined;
  previousRenders: PreviousRender[] | undefined;
  encodedUserId: string | undefined;
  folder = '';
  folderGcsPath = '';
  transcriptionText = '';
  transcriptionLoading = false;
  transcriptionLoaded = false;
  combosFolder = '';
  math = Math;
  json = JSON;
  stars: number[] = new Array(5).fill(0);
  renderQueue: RenderQueueVariant[] = [];
  renderQueueJsonArray: string[] = [];
  renderQueueName = '';
  displayObjectTracking = true;
  moveCropArea = false;
  weightsTextIndex = 3;
  weightsPersonFaceIndex = 1;
  weightSteps = [0, 10, 100, 1000];
  subtitlesTrack = '';
  webAppUrl = '';
  dragPosition = { x: 0, y: 0 };
  cropAreaRect?: DOMRect;
  nonLandscapeInputVideo = false;
  videoWidth = CONFIG.defaultVideoWidth;
  videoHeight = CONFIG.defaultVideoHeight;
  maxSquareWidth = CONFIG.defaultVideoHeight;
  maxVerticalWidth =
    CONFIG.defaultVideoHeight *
    (CONFIG.defaultVideoHeight / CONFIG.defaultVideoWidth);
  maxNonLandscapeHeight = CONFIG.defaultVideoHeight;
  maxRetries = CONFIG.maxRetries;
  showApprovalStatus = false;
  allSegmentsToggle = false;
  marked = marked;
  businessObjectives = Object.values(CONFIG.vertexAi.abcdBusinessObjectives);
  segmentMarkers: Record<string, SegmentMarker[]> = {};
  segmentSplitting = false;
  matchedAspectRatio?: string;
  aspectRatios = Object.keys(ASPECT_RATIOS);

  @ViewChild('VideoComboComponent') VideoComboComponent?: VideoComboComponent;
  @ViewChild('previewVideoElem')
  previewVideoElem!: ElementRef<HTMLVideoElement>;
  @ViewChild('previewTrackElem')
  previewTrackElem!: ElementRef<HTMLTrackElement>;
  @ViewChild('stepper') stepper!: MatStepper;
  videoUploadPanel: any = { open: () => { setTimeout(() => { if (this.stepper) this.stepper.selectedIndex = 0; }); }, close: () => { } };
  videoMagicPanel: any = { open: () => { setTimeout(() => { if (this.stepper) this.stepper.selectedIndex = 1; }); }, close: () => { } };
  youtubeIdeasPanel: any = { open: () => { setTimeout(() => { if (this.stepper) this.stepper.selectedIndex = 2; }); }, close: () => { } };
  @ViewChild('magicCanvas') magicCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('videoCombosPanel') videoCombosPanel!: MatExpansionPanel;
  @ViewChild('segmentModeToggle') segmentModeToggle!: MatButtonToggleGroup;
  @ViewChild('videosFilterToggle') videosFilterToggle!: MatSlideToggle;
  @ViewChild('renderQueueSidenav') renderQueueSidenav!: MatSidenav;
  @ViewChild('renderQueueButtonSpan')
  renderQueueButtonSpan!: ElementRef<HTMLSpanElement>;
  @ViewChild('reorderSegmentsToggle') reorderSegmentsToggle?: MatSlideToggle;
  @ViewChild('previewToggleGroup') previewToggleGroup!: MatButtonToggleGroup;
  @ViewChild('canvasDragElement')
  canvasDragElement?: ElementRef<HTMLDivElement>;
  @ViewChild('renderFormatsToggle') renderFormatsToggle!: MatButtonToggleGroup;
  @ViewChild('evalPromptTextarea')
  evalPromptTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('evalPromptPlaceholder')
  evalPromptPlaceholder?: ElementRef<HTMLDivElement>;
  @ViewChild(FileChooserComponent) fileChooserComponent!: FileChooserComponent;

  constructor(
    private apiCallsService: ApiCallsService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdRef: ChangeDetectorRef,
    private http: HttpClient
  ) {
    this.getPreviousRuns();
    this.getWebAppUrl();
    this.loadMapScripts();

    // Allow locally served app to process query params.
    // Production env (Apps Script) is handled via ngAfterViewInit()
    if (!environment.production) {
      inject(ActivatedRoute).queryParams.subscribe(params => {
        const inputCombosFolder = params['inputCombosFolder'];
        if (inputCombosFolder) {
          this.handleInputCombosFolder(inputCombosFolder);
        }
      });
    }
  }

  async loadMapScripts() {
    try {
      // MapLibre CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css';
      document.head.appendChild(link);

      // Load scripts sequentially (dependencies first)
      await this.loadScript('https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js');
      await this.loadScript('https://unpkg.com/h3-js@4.1.0/dist/h3-js.umd.js');
      await this.loadScript('https://unpkg.com/deck.gl@9.3.5/dist.min.js');
      
      this.mapScriptsLoaded = true;
      
      // If map is already open, init it now
      if (this.youtubePersonalizationMode === 'geokey') {
        this.initGeoMap();
      }
    } catch (error) {
      console.error('Error loading map scripts dynamically:', error);
    }
  }

  loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  ngAfterViewInit() {
    const inputCombosFolder = document.querySelector(
      '#input-combos-folder'
    ) as HTMLInputElement;
    if (inputCombosFolder && inputCombosFolder.value) {
      this.handleInputCombosFolder(inputCombosFolder.value);
    }
  }

  handleInputCombosFolder(inputCombosFolder: string) {
    this.videoUploadPanel.close();
    this.getRenderedCombos(inputCombosFolder);
  }

  failHandler(error: Error, folder?: string, startOver = false) {
    console.error('An unexpected error occurred: ', error);
    this.loading = false;
    this.generatingVariants = false;
    this.rendering = false;
    this.loadingVariant = false;
    this.generatingPreviews = false;
    this.isGeneratingYoutubeIdeas = false;
    this.stopAnalysisSimulation();
    this.snackBar
      .open('An unexpected error occurred.', 'Start over', {
        horizontalPosition: 'center',
      })
      .afterDismissed()
      .subscribe(() => {
        if (startOver) {
          this.videoUploadPanel.open();
          this.videoMagicPanel.close();
        }
        if (this.previewVideoElem.nativeElement) {
          this.previewVideoElem.nativeElement.pause();
        }
      });
    if (folder) {
      this.apiCallsService.deleteGcsFolder(folder);
      this.getPreviousRuns();
    }
  }

  getWebAppUrl() {
    this.apiCallsService.getWebAppUrl().subscribe({
      next: url => {
        this.webAppUrl = url;
      },
      error: err => this.failHandler(err),
    });
  }

  getPreviousRuns() {
    this.apiCallsService.getRunsFromGcs().subscribe({
      next: result => {
        this.previousRuns = result.runs;
        this.encodedUserId = result.encodedUserId;
      },
      error: err => this.failHandler(err),
    });
  }

  getPreviousRenders() {
    this.apiCallsService.getRendersFromGcs(this.folder).subscribe({
      next: result => {
        this.previousRenders = result.map((render: string) => {
          const hasName = render.includes(CONFIG.videoFolderNameSeparator);
          const displayName =
            (hasName
              ? render.split(CONFIG.videoFolderNameSeparator)[0]
              : 'N/A') +
            ' (' +
            new Date(
              Number(
                (hasName
                  ? render.split(CONFIG.videoFolderNameSeparator)[1]
                  : render
                ).replace('-combos', '')
              )
            ).toLocaleString() +
            ')';
          return { displayName, value: render };
        });
      },
      error: err => this.failHandler(err),
    });
  }

  isCurrentUserRun(run: string) {
    if (this.videosFilterToggle && this.videosFilterToggle.checked) {
      const encodedUserId = run.split('--').at(-1);
      return encodedUserId === this.encodedUserId;
    }
    return true;
  }

  selectedFileDurationStr = 'Procesando...';
  selectedFileResolutionStr = 'Procesando...';
  selectedFileThumbnail = '';

  onFileSelected(file?: File) {
    this.selectedFile = file;
    if (file) {
      this.selectedHistoryRun = '';
      this.selectedFileDurationStr = 'Procesando...';
      this.selectedFileResolutionStr = 'Procesando...';
      this.selectedFileThumbnail = '';

      const objectUrl = URL.createObjectURL(file);
      const videoElem = document.createElement('video');
      videoElem.src = objectUrl;
      videoElem.muted = true;
      videoElem.playsInline = true;
      videoElem.preload = 'metadata';

      videoElem.onloadedmetadata = () => {
        this.selectedFileResolutionStr = `${videoElem.videoWidth} x ${videoElem.videoHeight}`;
        const durationSec = videoElem.duration;
        const mins = Math.floor(durationSec / 60);
        const secs = Math.floor(durationSec % 60);
        this.selectedFileDurationStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // Load the first frame to capture thumbnail
        videoElem.currentTime = 0.1;
      };

      videoElem.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoElem.videoWidth;
        canvas.height = videoElem.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
          this.selectedFileThumbnail = canvas.toDataURL('image/jpeg');
        }
        URL.revokeObjectURL(objectUrl);
        this.cdRef.detectChanges();
      };
    }
  }

  getCurrentCropAreaFrame(entities: VideoObject[]):
    | {
      currentFrame: VideoFrame;
      idx: number;
    }
    | undefined {
    const timestamp = this.previewVideoElem.nativeElement.currentTime;
    for (let i = 0; i < entities[0].frames.length; i++) {
      if (entities[0].frames[i].time >= timestamp) {
        return { currentFrame: entities[0].frames[i], idx: i };
      }
    }
    return;
  }

  drawFrame(entities?: VideoObject[]) {
    const context = this.canvas;
    if (!context || !this.previewVideoElem || !this.previewVideoElem.nativeElement) {
      return;
    }
    context.clearRect(0, 0, this.videoWidth, this.videoHeight);

    if (this.useBlankingFill) {
      context.fillStyle = 'rgba(0, 0, 0, 0.7)';
      context.fillRect(0, 0, this.videoWidth, this.videoHeight);

      context.font = '30px Roboto';
      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('Blanking Fill Active', this.videoWidth / 2, this.videoHeight / 2);
      return;
    }

    if (!entities) {
      return;
    }

    if (this.displayObjectTracking) {
      const timestamp = this.previewVideoElem.nativeElement.currentTime;
      entities.forEach(e => {
        if (e.start <= timestamp && e.end >= timestamp) {
          for (let i = 0; i < e.frames.length; i++) {
            if (e.frames[i].time >= timestamp) {
              this.drawEntity(
                e.name,
                e.frames[i].x,
                e.frames[i].y,
                e.frames[i].width,
                e.frames[i].height
              );
              break;
            }
          }
        }
      });
    }
  }

  setCurrentSegmentId() {
    if (!this.avSegments || !this.previewVideoElem || !this.previewVideoElem.nativeElement) {
      this.currentSegmentId = undefined;
      return;
    }
    const timestamp = this.previewVideoElem.nativeElement.currentTime;
    const currentSegment = this.avSegments.find(
      (segment: AvSegment) =>
        segment.start_s <= timestamp && segment.end_s >= timestamp
    );
    if (
      !currentSegment ||
      Number(currentSegment.av_segment_id) === this.currentSegmentId
    ) {
      return;
    }
    this.currentSegmentId = Number(currentSegment.av_segment_id);
  }

  drawEntity(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const context = this.canvas;
    if (context) {
      context.font = '20px Roboto';
      context.strokeStyle = '#81c784';
      context.beginPath();
      context.lineWidth = 4;
      context.rect(x, y, width, height);
      context.stroke();
      context.fillStyle = '#81c784';
      context.fillRect(x, y, width, 32);
      context.fillStyle = '#ffffff';
      context.fillText(text, x + 5, y + 22);
    }
  }

  parseAnalysis(objectsJson: VideoAnalysisJson, filterCondition: (e: ObjectAnnotation) => boolean) {
    const vw = this.videoWidth;
    const vh = this.videoHeight;
    const toSeconds = (t: string) =>
      TimeUtil.timestampToSeconds(
        t as unknown as Parameters<typeof TimeUtil.timestampToSeconds>[0]
      );
    return objectsJson.annotation_results[0].object_annotations
      .filter(filterCondition)
      .map((e: ObjectAnnotation) => {
        return {
          name: e.entity.description,
          start: toSeconds(e.segment.start_time_offset),
          end: toSeconds(e.segment.end_time_offset),
          frames: e.frames.map((f: FrameAnnotation) => {
            return {
              x: vw * (f.normalized_bounding_box.left || 0),
              y: vh * (f.normalized_bounding_box.top || 0),
              width:
                vw *
                ((f.normalized_bounding_box.right || 0) -
                  (f.normalized_bounding_box.left || 0)),
              height:
                vh *
                ((f.normalized_bounding_box.bottom || 0) -
                  (f.normalized_bounding_box.top || 0)),
              time: toSeconds(f.time_offset),
            };
          }),
        };
      });
  }

  getAvSegments() {
    this.segmentsStatus = 'pending';
    // Cap retries at 80 (480 seconds max wait = 8 minutes)
    const maxSegmentRetries = Math.min(this.maxRetries, 80);
    this.apiCallsService
      .getFromGcs(
        `${this.folder}/${CONFIG.cloudStorage.files.data}`,
        CONFIG.retryDelay,
        maxSegmentRetries
      )
      .subscribe({
        next: data => {
          const dataJson = JSON.parse(data);
          this.avSegments = (
            dataJson.map((e: AvSegment) => {
              if (typeof e.av_segment_id === 'number') {
                e.av_segment_id = String(e.av_segment_id + 1);
              }
              if (e.av_segment_id.endsWith('.0')) {
                e.av_segment_id = e.av_segment_id.replace('.0', '');
              }
              // MODIFICACION A URL PUBLICAS DEL BUCKET 
              if (e.segment_screenshot_uri) {
                e.segment_screenshot_uri = e.segment_screenshot_uri.replace('storage.mtls.cloud.google.com', 'storage.googleapis.com');
              }
              if (e.segment_uri) {
                e.segment_uri = e.segment_uri.replace('storage.mtls.cloud.google.com', 'storage.googleapis.com');
              }
              e.selected = false;
              e.splitting = false;
              return e;
            }) as AvSegment[]
          ).sort((a: AvSegment, b: AvSegment) => a.start_s - b.start_s);
          this.originalAvSegments = structuredClone(this.avSegments);

          if (this.avSegments.length === 1) {
            this.shortenVideo = false;
            this.selectedPromptOption = 'crop-only';
            this.onPromptSelectionChange();
            console.warn('Only 1 segment - shortening disabled.');
          }

          this.segmentsStatus = 'check_circle';
          this.loading = false;
          this.stopAnalysisSimulation();
          if (!this.nonLandscapeInputVideo) {
            this.generatePreviews();
          }
        },
        error: err => {
          this.loading = false;
          this.segmentsStatus = 'hourglass_top';
          console.error('Failed to load segments data:', err);
          alert(
            'Failed to load video segments. The video may still be processing. ' +
            'Please try again in a few moments.'
          );
          this.videoMagicPanel.close();
          this.videoUploadPanel.open();
        },
      });

    // Load transcription if available
    this.loadTranscription();
  }

  loadTranscription() {
    if (!this.analyseAudio || !this.folder) {
      this.transcriptionLoaded = true;
      return;
    }

    this.transcriptionLoading = true;
    this.transcriptionLoaded = false;
    const transcriptionUrl = `${this.folder}/${CONFIG.cloudStorage.files.subtitles}`;
    console.log('Loading transcription from:', transcriptionUrl);
    this.apiCallsService.getFromGcs(transcriptionUrl).subscribe({
      next: (data: string) => {
        console.log('VTT transcription loaded, length:', data.length);
        this.transcriptionText = data;
        this.transcriptionLoading = false;
        this.transcriptionLoaded = true;
      },
      error: (err) => {
        console.log('Error loading transcription:', err);
        this.transcriptionText = '';
        this.transcriptionLoading = false;
        this.transcriptionLoaded = true;
      }
    });
  }

  applyTranscription() {
    if (!this.transcriptionText) {
      this.snackBar.open('Transcription is empty', 'Dismiss', {
        duration: 2500,
      });
      return;
    }

    this.transcriptionLoading = true;
    this.apiCallsService
      .updateTranscription(this.folder, this.transcriptionText)
      .subscribe({
        next: (success: boolean) => {
          this.transcriptionLoading = false;
          if (success) {
            this.snackBar.open('Transcription updated successfully! Reloading...', 'Dismiss', {
              duration: 2500,
            });
            // Reload subtitles and segments to get updated transcription
            this.getSubtitlesTrack();
          } else {
            this.snackBar.open('Failed to update transcription', 'Dismiss', {
              duration: 2500,
            });
          }
        },
        error: (err: Error) => {
          this.transcriptionLoading = false;
          this.failHandler(err, this.folder, false);
        }
      });
  }

  getRenderedCombos(folder: string) {
    this.combosFolder = folder;
    this.loading = true;
    this.combinationStatus = 'pending';
    this.previewVideoElem.nativeElement.pause();
    this.videoMagicPanel.close();
    this.videoCombosPanel.open();
    this.combos = undefined;
    // Rendering can take a long time (especially for blur effects)
    // 80 retries * 6s = 480s = 8 minutes
    const maxCombosRetries = Math.min(this.maxRetries, 80);
    this.apiCallsService
      .getFromGcs(
        `${folder}/${CONFIG.cloudStorage.files.combos}`,
        CONFIG.retryDelay,
        maxCombosRetries
      )
      .subscribe({
        next: data => {
          this.combosJson = JSON.parse(data);
          this.setCombos();
          this.combinationStatus = 'check_circle';
          this.loading = false;
          this.previewVideoElem.nativeElement.pause();
          this.videoMagicPanel.close();
          this.videoCombosPanel.open();
          this.storeCombosApproval(false);
        },
        error: err => {
          this.loading = false;
          this.combinationStatus = 'hourglass_top';
          console.error('Failed to load rendered videos:', err);
          alert(
            'Rendering is taking longer than expected (>5 minutes).\n\n' +
            'This can happen for complex videos with blur effects or format conversions. ' +
            'The rendering may still be in progress.\n\n' +
            'Please wait a minute and try clicking "Load saved video" again to check if rendering has completed.'
          );
          this.videoCombosPanel.close();
          this.videoMagicPanel.open();
        },
      });
  }

  getVideoAnalysis() {
    this.analysisStatus = 'pending';
    // Cap retries at 80 (480 seconds max wait = 8 minutes)
    const maxAnalysisRetries = Math.min(this.maxRetries, 80);
    this.apiCallsService
      .getFromGcs(
        `${this.folder}/${CONFIG.cloudStorage.files.analysis}`,
        CONFIG.retryDelay,
        maxAnalysisRetries
      )
      .subscribe({
        next: data => {
          this.analysisJson = JSON.parse(data) as VideoAnalysisJson;
          this.analysisStatus = 'check_circle';
          this.videoObjects = this.parseAnalysis(
            this.analysisJson,
            (e: ObjectAnnotation) =>
              e.confidence > CONFIG.videoIntelligenceConfidenceThreshold
          );
          this.activeVideoObjects = this.videoObjects;
          this.getAvSegments();
        },
        error: err => {
          this.loading = false;
          this.analysisStatus = 'hourglass_top';
          console.error('Failed to load video analysis:', err);
          alert(
            'Failed to load video analysis. The video may still be processing. ' +
            'Please try again in a few moments.'
          );
          this.videoMagicPanel.close();
          this.videoUploadPanel.open();
        },
      });
  }

  getSubtitlesTrack() {
    this.transcriptStatus = 'pending';
    // Cap retries at 80 (480 seconds max wait = 8 minutes)
    const maxSubtitleRetries = Math.min(this.maxRetries, 80);
    this.apiCallsService
      .getFromGcs(
        `${this.folder}/${CONFIG.cloudStorage.files.subtitles}`,
        CONFIG.retryDelay,
        maxSubtitleRetries
      )
      .subscribe({
        next: data => {
          const dataUrl = `data:text/vtt;base64,${StringUtil.encode(data)}`;
          this.transcript = data;
          this.previewTrackElem.nativeElement.src = dataUrl;
          this.subtitlesTrack = this.previewTrackElem.nativeElement.src;
          this.transcriptStatus = 'check_circle';
          this.getVideoAnalysis();
        },
        error: err => {
          this.loading = false;
          this.transcriptStatus = 'hourglass_top';
          console.error('Failed to load subtitles:', err);
          alert(
            'Failed to load video subtitles. This may happen if:\n' +
            '- The video is still being processed\n' +
            '- You selected a previously rendered video that was re-uploaded\n' +
            '- The subtitle file does not exist\n\n' +
            'Please try selecting the original uploaded video instead, ' +
            'or re-upload and process the video.'
          );
          this.videoMagicPanel.close();
          this.videoCombosPanel.close();
          this.videoUploadPanel.open();
        },
      });
  }

  downloadTranscript(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.transcript) {
      const blob = new Blob([this.transcript], { type: 'text/vtt' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'transcript.vtt';
      anchor.click();
      window.URL.revokeObjectURL(url);
    }
  } selectedHistoryRun: string = '';

  loadPreviousRun(folder: string) {
    this.loading = true;
    const response = this.apiCallsService.loadPreviousRun(folder);
    this.processVideo(response[0], response[1]);
  }

  loadPreviousRender(folder: string) {
    this.combos = undefined;
    this.getRenderedCombos(`${this.folder}/${folder}`);
  }

  showAnalysisModal = false;

  isAnalysisInProgress = false;
  isAnalysisComplete = false;
  activeDashboardTab = 'creative';
  currentProgressStep = 1;

  startAnalysisSimulation() {
    this.isAnalysisInProgress = true;
    this.isAnalysisComplete = false;
    this.currentProgressStep = 1;
    this.compassData = null;
    this.compassJson = '';
    this.compassStepError = '';
  }

  /** Advance the visible step indicator */
  private advanceStep(step: number) {
    this.currentProgressStep = step;
    this.cdRef.detectChanges();
  }

  stopAnalysisSimulation() {
    // Legacy usage (error path): just hide the modal
    this.isAnalysisInProgress = false;
    this.isAnalysisComplete = false;
  }

  goToCompass() {
    this.isAnalysisInProgress = false;
    this.stepper.next();
  }

  goToInsights() {
    this.isAnalysisInProgress = false;
    this.stepper.next();
  }

  setDashboardTab(tab: string) {
    this.activeDashboardTab = tab;
    if (tab === 'geo') {
      setTimeout(() => {
        this.initGeoMap();
      }, 100);
    } else if (tab === 'category') {
      setTimeout(() => {
        this.initCategoryCharts();
      }, 100);
    }
  }

  initCategoryCharts() {
    const chartEl = document.getElementById('channel-donut-chart');
    if (!chartEl) return;

    if (!this.categoryChartInstance) {
      this.categoryChartInstance = echarts.init(chartEl);
    }

    const option = {
      tooltip: {
        trigger: 'item'
      },
      legend: {
        orient: 'vertical',
        right: '10%',
        top: 'center',
        icon: 'circle',
        textStyle: {
          color: '#64748b'
        }
      },
      color: ['#ff0000', '#6366f1', '#3b82f6', '#eab308', '#f59e0b'],
      series: [
        {
          name: 'Afinidad',
          type: 'pie',
          radius: ['50%', '70%'],
          center: ['30%', '50%'],
          avoidLabelOverlap: false,
          label: {
            show: true,
            position: 'center',
            formatter: '{val|83}\n{desc|Afinidad\npromedio}',
            rich: {
              val: {
                fontSize: 32,
                fontWeight: 'bold',
                color: '#0f172a',
                lineHeight: 40
              },
              desc: {
                fontSize: 11,
                color: '#64748b',
                lineHeight: 14
              }
            }
          },
          labelLine: {
            show: false
          },
          data: [
            { value: 92, name: 'YouTube (92/100)' },
            { value: 85, name: 'CTV (85/100)' },
            { value: 78, name: 'Mobile (78/100)' },
            { value: 65, name: 'Web (65/100)' },
            { value: 55, name: 'Social (55/100)' }
          ]
        }
      ]
    };

    this.categoryChartInstance.setOption(option);
  }

  initGeoMap() {
    if (!this.mapScriptsLoaded) {
      console.warn('Map scripts not yet loaded, waiting...');
      return;
    }

    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
    }

    // Initialize MapLibre base map
    this.mapInstance = new maplibregl.Map({
      container: 'map-container',
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-102.5528, 23.6345], // Centro de México
      zoom: 4,
      pitch: 45,
      bearing: 0,
      attributionControl: false
    });

    if (this.h3MapData && this.h3MapData.length > 0) {
      const maxValue = Math.max(...this.h3MapData.map((d: any) => d.value));

      const h3Layer = new deck.H3HexagonLayer({
        id: 'h3-hexagon-layer',
        data: this.h3MapData,
        pickable: true,
        wireframe: false,
        filled: true,
        extruded: false, // Apagamos la extrusión extrema 3D
        coverage: 0.6,   // Reducimos el tamaño para separar los hexágonos (efecto de puntos/píxeles)
        getHexagon: (d: any) => d.h3_id,
        getFillColor: (d: any) => {
          const ratio = d.value / maxValue;
          // Un color más parecido a tu referencia (tonos crema/dorado claro) con algo de calor
          return [216 + (ratio * 39), 211 - (ratio * 50), 193 - (ratio * 100), 255]; 
        },
        onHover: (info: any) => {
          const tooltip = document.getElementById('deck-tooltip');
          if (tooltip) {
            if (info.object) {
              tooltip.style.display = 'block';
              tooltip.style.left = (info.x + 15) + 'px';
              tooltip.style.top = (info.y + 15) + 'px';
              tooltip.innerHTML = `
                <div style="margin-bottom: 4px; font-weight: 500; color: #aef366; font-family: 'Outfit', sans-serif;">Detalle de Zona</div>
                <div style="margin-bottom: 2px;"><strong>ID:</strong> ${info.object.h3_id}</div>
                <div style="margin-bottom: 2px;"><strong>Ubicación:</strong> ${info.object.municipio}, ${info.object.estado}</div>
                <div><strong>Audiencia:</strong> ${info.object.value.toLocaleString()} personas</div>
              `;
            } else {
              tooltip.style.display = 'none';
            }
          }
        }
      });

      this.deckOverlay = new deck.MapboxOverlay({
        interleaved: true,
        layers: [h3Layer]
      });

      this.mapInstance.addControl(this.deckOverlay as any);
    }
  }

  processVideoSelection() {
    this.showAnalysisModal = true;
  }

  confirmAnalysis() {
    this.showAnalysisModal = false;
    if (this.selectedHistoryRun) {
      this.loadPreviousRun(this.selectedHistoryRun);
    } else if (this.selectedFile) {
      this.uploadVideo();
    }
  }

  uploadVideo() {
    this.loading = true;
    this.startAnalysisSimulation();
    this.apiCallsService
      .uploadVideo(this.selectedFile!, this.analyseAudio, this.encodedUserId!)
      .subscribe({
        next: response => {
          const folder = response[0];
          const videoPath = response[1];
          const isConverting = response[2] === 'converting';

          this.fileChooserComponent.stopVideo();
          // Inject brand context into all predefined prompts before switching panels
          this.refreshPromptsWithBrand();
          this.processVideo(folder, videoPath, false);

          if (isConverting) {
            // For .mov files, wait for conversion and update both previews
            console.log('Waiting for video conversion...');
            this.fileChooserComponent.convertingVideo = true;
            // Keep the message showing in file chooser
            this.fileChooserComponent.isMovFile = true;

            this.apiCallsService.waitForConvertedVideo(folder).subscribe({
              next: convertedVideoUrl => {
                console.log('Video converted, updating previews...');
                // Update the file chooser preview with the converted MP4
                this.fileChooserComponent.selectedFileUrl = convertedVideoUrl;
                this.fileChooserComponent.isMovFile = false;
                this.fileChooserComponent.convertingVideo = false;
                this.fileChooserComponent.videoElem.nativeElement.load();

                // Also update the main video editing preview if it's loaded
                if (this.previewVideoElem && this.videoPath) {
                  console.log('Updating main video preview with converted file...');
                  this.videoPath = convertedVideoUrl;
                  this.previewVideoElem.nativeElement.src = convertedVideoUrl;
                  this.previewVideoElem.nativeElement.load();
                }
              },
              error: conversionError => {
                console.error('Failed to convert video:', conversionError);
                this.fileChooserComponent.convertingVideo = false;

                // Re-check the file extension to properly display the state
                if (this.fileChooserComponent.selectedFile) {
                  const fileExtension = this.fileChooserComponent.selectedFile.name.split('.').pop()?.toLowerCase();
                  this.fileChooserComponent.isMovFile = fileExtension === 'mov';
                }

                this.loading = false;

                // Show error to user
                alert(
                  'Video conversion failed. The .mov file could not be converted to MP4 format. ' +
                  'Please try uploading the video again or use a different video format (e.g., MP4).'
                );

                // Reset to upload panel to allow user to try again
                this.videoMagicPanel.close();
                this.videoCombosPanel.close();
                this.videoUploadPanel.open();
              }
            });
          }
        },
        error: err => this.failHandler(err),
      });
  }

  resetState() {
    this.rendering = false;
    this.generatingPreviews = false;
    this.analysisJson = undefined;
    this.avSegments = undefined;
    this.originalAvSegments = undefined;
    this.combosJson = undefined;
    this.combos = undefined;
    this.originalCombos = undefined;
    this.activeVideoObjects = undefined;
    this.videoObjects = undefined;
    this.squareVideoObjects = undefined;
    this.verticalVideoObjects = undefined;
    this.variants = undefined;
    this.previewAnalyses = {};
    this.transcript = undefined;
    this.transcriptStatus = 'hourglass_top';
    this.analysisStatus = 'hourglass_top';
    this.combinationStatus = 'hourglass_top';
    this.segmentsStatus = 'hourglass_top';
    this.renderQueue = [];
    this.renderQueueJsonArray = [];
    this.renderQueueName = '';
    this.previousRenders = undefined;
    this.segmentModeToggle.value = 'preview';
    this.previewToggleGroup.value = 'toggle';
    this.displayObjectTracking = true;
    this.moveCropArea = false;
    this.previewTrackElem.nativeElement.src = '';
    this.subtitlesTrack = '';
    this.cropAreaRect = undefined;
    this.nonLandscapeInputVideo = false;
    this.matchedAspectRatio = undefined;
    this.audioSettings = 'segment';
    this.overlaySettings = 'variant_start';
    this.fadeOut = false;
    this.useBlankingFill = false;
    this.allSegmentsToggle = false;
    this.demandGenAssets = true;
    this.analyseAudio = false;
    this.segmentMarkers = {};
    this.previewVideoElem.nativeElement.pause();
    this.VideoComboComponent?.videoElem.nativeElement.pause();
    this.videoMagicPanel.close();
    this.videoCombosPanel.close();
    this.videoUploadPanel.open();
  }

  resetVideoCanvas() {
    this.magicCanvas.nativeElement.style.removeProperty('width');
    this.magicCanvas.nativeElement.style.removeProperty('height');
    this.videoWidth = CONFIG.defaultVideoWidth;
    this.videoHeight = CONFIG.defaultVideoHeight;
    const segmentsListElement = document.querySelector(
      'segments-list'
    )! as HTMLElement;
    segmentsListElement.style.setProperty(
      '--filmstrip-image-width',
      `${CONFIG.defaultVideoWidth / 5}px`
    );
    segmentsListElement.style.setProperty(
      '--filmstrip-image-height',
      `${CONFIG.defaultVideoHeight / 5}px`
    );
  }

  processVideo(
    folder: string,
    videoFilePath: string,
    getPreviousRenders = true
  ) {
    this.resetState();
    this.folder = folder;

    // Auto-advance to the second step (Análisis de Video)
    if (this.stepper) {
      setTimeout(() => this.stepper.next(), 50);
    }

    this.analyseAudio = !folder.includes(
      `${CONFIG.videoFolderNameSeparator}${CONFIG.videoFolderNoAudioSuffix}${CONFIG.videoFolderNameSeparator}`
    );
    this.videoPath = videoFilePath;
    this.getGcsFolderPath();
    this.previewVideoElem.nativeElement.src = this.videoPath;
    this.previewVideoElem.nativeElement.onloadeddata = () => {
      this.resetVideoCanvas();
      this.nonLandscapeInputVideo =
        this.previewVideoElem.nativeElement.videoWidth <=
        this.previewVideoElem.nativeElement.videoHeight;

      if (this.nonLandscapeInputVideo) {
        this.videoWidth = Math.min(
          this.previewVideoElem.nativeElement.videoWidth,
          this.previewVideoElem.nativeElement.videoWidth ===
            this.previewVideoElem.nativeElement.videoHeight
            ? this.maxSquareWidth
            : this.maxVerticalWidth
        );
        this.videoHeight = Math.min(
          this.previewVideoElem.nativeElement.videoHeight,
          this.maxNonLandscapeHeight
        );
        const segmentsListElement = document.querySelector(
          'segments-list'
        )! as HTMLElement;
        segmentsListElement.style.setProperty(
          '--filmstrip-image-width',
          this.videoWidth / 5 + 'px'
        );
        segmentsListElement.style.setProperty(
          '--filmstrip-image-height',
          this.videoHeight / 5 + 'px'
        );
      } else {
        this.magicCanvas.nativeElement.setAttribute(
          'style',
          'width: 100%; height: 100%'
        );
      }
      this.magicCanvas.nativeElement.width = this.videoWidth;
      this.magicCanvas.nativeElement.height = this.videoHeight;
      this.canvas = this.magicCanvas.nativeElement.getContext('2d')!;
      this.calculateVideoDefaultDuration(
        this.previewVideoElem.nativeElement.duration
      );

      // Identify aspect ratio
      const vW = this.previewVideoElem.nativeElement.videoWidth;
      const vH = this.previewVideoElem.nativeElement.videoHeight;
      const ratio = vW / vH;
      this.matchedAspectRatio = undefined;
      for (const [key, val] of Object.entries(ASPECT_RATIOS)) {
        if (Math.abs(ratio - val) / val <= ASPECT_RATIO_TOLERANCE) {
          this.matchedAspectRatio = key;
          break;
        }
      }

      // Increments by 1 for every additional video minute
      const minutesFactor =
        Math.floor((this.previewVideoElem.nativeElement.duration - 1) / 60) + 1;
      // Wait a total of 10 minutes per minute of video, for a max of 1 hour
      this.maxRetries = Math.min(
        this.maxRetries * minutesFactor,
        CONFIG.maxRetries
      );
      this.previewVideoElem.nativeElement.onloadeddata = null;
    };
    this.previewVideoElem.nativeElement.onplaying = () => {
      this.frameInterval = window.setInterval(() => {
        this.drawFrame(this.activeVideoObjects);
        const skipped = this.skipSegment();
        if (!skipped) {
          this.setCurrentSegmentId();
        }
      }, 10);
    };
    this.previewVideoElem.nativeElement.onpause = () => {
      if (this.frameInterval) {
        clearInterval(this.frameInterval);
        this.frameInterval = undefined;
      }
      // Draw the current frame when paused to keep overlay visible
      this.drawFrame(this.activeVideoObjects);
    };
    this.previewVideoElem.nativeElement.onended = () => {
      this.resetVariantPreview();
    };
    this.videoUploadPanel.close();
    this.videoMagicPanel.open();
    this.getSubtitlesTrack();
    if (getPreviousRenders) {
      this.getPreviousRenders();
    } else {
      this.previousRenders = [];
    }
  }

  getGcsFolderPath() {
    this.apiCallsService
      .getGcsFolderPath(this.folder)
      .subscribe((path: string) => {
        this.folderGcsPath = path;
      });
  }

  calculateVideoDefaultDuration(duration: number) {
    const halfDuration = Math.round(duration / 2);
    this.step = CONFIG.defaultVideoDurationStep;
    this.duration = Math.min(30, halfDuration - (halfDuration % this.step));
  }

  onPromptKeydown(event: KeyboardEvent) {
    if (event.key === 'Tab' && !this.prompt) {
      event.preventDefault();
      this.prompt = this.defaultPrompt;
    }
  }

  onPromptSelectionChange() {
    // Read from base prompts to avoid double-appending brand suffix
    const base = this.basePredefinedPrompts.find(p => p.value === this.selectedPromptOption);
    const selected = this.predefinedPrompts.find(p => p.value === this.selectedPromptOption);
    if (selected && base) {
      this.isCustomPrompt = selected.value === 'custom';
      // Set shortenVideo based on selection
      this.shortenVideo = selected.value !== 'crop-only';
      if (this.isCustomPrompt) {
        this.prompt = '';
      } else {
        // Use base text + brand suffix so context is always current
        this.prompt = base.text + this.buildBrandSuffix();
      }
    }
  }

  /**
   * Builds the brand context suffix injected into every predefined prompt.
   * Returns an empty string when no brand data has been entered.
   */
  buildBrandSuffix(): string {
    const parts: string[] = [];
    if (this.brandName) parts.push(`Brand: ${this.brandName}`);
    if (this.advertiserName) parts.push(`Advertiser: ${this.advertiserName}`);
    if (this.country) parts.push(`Target Country: ${this.country}`);
    if (this.brandColor) parts.push(`Primary brand color (hex): ${this.brandColor}`);
    if (this.brandColor2) parts.push(`Secondary brand color (hex): ${this.brandColor2}`);
    if (this.brandColor3) parts.push(`Tertiary brand color (hex): ${this.brandColor3}`);
    if (this.communicationTone) parts.push(`Communication tone: ${this.communicationTone}`);
    if (!parts.length) return '';
    return ` Strictly follow these brand guidelines — ${parts.join('; ')}.`;
  }

  /**
   * Called after Upload Video to bake brand context into every predefined prompt.
   * Also updates the currently active prompt text.
   */
  refreshPromptsWithBrand() {
    const suffix = this.buildBrandSuffix();
    this.predefinedPrompts = this.basePredefinedPrompts.map(base => {
      const display = this.predefinedPrompts.find(p => p.value === base.value);
      return {
        value: base.value,
        label: display?.label ?? base.value,
        text: base.value === 'custom' ? '' : base.text + suffix,
      };
    });
    // Re-apply selection so this.prompt reflects the new suffix
    if (!this.isCustomPrompt) {
      this.onPromptSelectionChange();
    }
  }

  onShortenVideoChange(shorten: boolean) {
    if (shorten && this.avSegments && this.avSegments.length === 1) {
      this.shortenVideo = false;
      this.snackBar.open(
        'Cannot enable shortening with only 1 segment. ' +
        'Use crop-only mode or split the segment first.',
        'Dismiss',
        { duration: 5000 }
      );
      return;
    }

    if (shorten) {
      // When enabling shortening, switch to default prompt
      this.selectedPromptOption = 'default';
    } else {
      // When disabling shortening, switch to crop-only prompt
      this.selectedPromptOption = 'crop-only';
    }
    this.onPromptSelectionChange();
  }

  async analyzeFullVideo() {
    console.log('Compass: analyzeFullVideo() — orchestrated pipeline starting');
    this.loading = true;
    this.generatingVariants = true;
    this.startAnalysisSimulation();

    // ── PASO 1: Video ya cargado (estado ya activo, step = 1) ────────────────
    // El modal ya muestra el paso 1 como en progreso. Avanzamos inmediatamente.
    this.advanceStep(1);

    try {
      // ── PASO 2 (SIMULADO): Aplicando contexto de campaña y marca ──────────
      this.advanceStep(2);

      // Construimos el núcleo del CompassData con los datos del formulario
      const contextoCampania = {
        nombre_campania: this.campaignName,
        objetivo_negocio: this.businessObjective,
        audiencia: this.targetAudience,
        tono: this.communicationTone,
        descripcion: this.campaignDescription,
        lineamientos_marca: this.brandGuidelines,
        consideraciones: this.specialConsiderations,
        contexto_mercado: this.marketContext,
      };

      this.compassData = {
        meta: {
          brand: this.brandName,
          campaign: this.campaignName,
          country: this.country,
          objective: this.selectedFullVideoObjective,
          date: this.activationDate || new Date().toISOString().slice(0, 10),
          video_name: this.selectedFile?.name || this.selectedHistoryRun || 'Video',
          video_duration: this.selectedFileDurationStr || 'N/A',
          internal_ref: this.internalReference,
        },
        contexto_campania: contextoCampania,
        evaluacion_creativa: null,
        geo_intelligence: null,
        channel_intelligence: null,
        prioridades: null,
      };

      // Simulamos una pequeña pausa visual para el paso 2
      await new Promise(resolve => setTimeout(resolve, 800));

      // ── PASO 3 (REAL): Analizando señales creativas (ABCD) ─────────────────
      this.advanceStep(3);

      const abcdBusinessObjectives = CONFIG.vertexAi.abcdBusinessObjectives as any;
      const selectedEvalPrompt = abcdBusinessObjectives[this.selectedFullVideoObjective]?.promptPart || '';

      const variantsResponse: any = await firstValueFrom(
        this.apiCallsService.generateVariants(this.folder, {
          prompt: '',
          evalPrompt: selectedEvalPrompt,
          duration: this.originalAvSegments
            ? this.originalAvSegments.reduce((total, seg) => total + (seg.end_s - seg.start_s), 0)
            : 0,
          demandGenAssets: this.demandGenAssets,
          shortenVideo: false,
          fullVideoAnalysis: true,
          ...(this.brandName || this.advertiserName || this.country || this.brandColor
            ? {
              brandParams: {
                brandName: this.brandName,
                advertiserName: this.advertiserName,
                country: this.country,
                brandColor: this.brandColor,
                brandColor2: this.brandColor2,
                brandColor3: this.brandColor3,
                communicationTone: this.communicationTone,
              }
            }
            : {})
        })
      );

      // Procesar respuesta ABCD
      this.variants = variantsResponse.map((v: any) => {
        if (v.av_segments) {
          v.av_segments.forEach((seg: any) => {
            if (seg.segment_screenshot_uri) seg.segment_screenshot_uri = seg.segment_screenshot_uri.replace('storage.mtls.cloud.google.com', 'storage.googleapis.com');
            if (seg.segment_uri) seg.segment_uri = seg.segment_uri.replace('storage.mtls.cloud.google.com', 'storage.googleapis.com');
          });
        }
        return v;
      });

      if (this.variants && this.variants.length > 0) {
        this.fullVideoEvaluationResult = this.variants[0];
        const ev = this.fullVideoEvaluationResult;
        this.compassData.evaluacion_creativa = {
          score: ev.score || 0,
          score_max: this.getMaxScore(),
          score_label: this.getScoreLabel(ev.score || 0),
          abcd: {
            attention: ev.abcd?.attention || '',
            branding: ev.abcd?.branding || '',
            connection: ev.abcd?.connection || '',
            direction: ev.abcd?.direction || '',
          },
          strengths: ev.strengths || [],
          weaknesses: ev.weaknesses || [],
          descripcion: ev.description || '',
        };
      }

      this.loading = false;
      this.generatingVariants = false;
      this.selectedVariant = 0;
      this.segmentsStatus = 'check_circle';
      this.analysisStatus = 'check_circle';
      this.transcriptStatus = 'check_circle';
      this.setSelectedSegments();
      this.cdRef.detectChanges();

      // ── PASO 4 (CONDICIONAL — REAL): Geo Intelligence ──────────────────────
      if (this.hasGeoData) {
        this.advanceStep(4);
        try {
          const contextParcial = JSON.stringify({
            meta: this.compassData.meta,
            contexto_campania: this.compassData.contexto_campania,
            evaluacion_creativa: this.compassData.evaluacion_creativa,
          });
          const geoResponseRaw = await firstValueFrom(
            this.apiCallsService.generateGeoIntelligence(
              contextParcial,
              this.aiSummaryJson,
              this.microOpportunitiesJson
            )
          );
          const geoData = JSON.parse(geoResponseRaw);
          this.compassData.geo_intelligence = {
            macro_estrategias: geoData.macro_estrategias || [],
            micro_oportunidades: geoData.micro_oportunidades || [],
          };
        } catch (geoError) {
          console.error('Compass: Geo Intelligence step failed (non-fatal)', geoError);
          this.compassData.geo_intelligence = null;
        }
      }

      // ── PASO 5 (CONDICIONAL — REAL): Channel & Category Intelligence ────────
      if (this.hasChannelData) {
        this.advanceStep(5);
        try {
          const contextParcial = JSON.stringify({
            meta: this.compassData.meta,
            contexto_campania: this.compassData.contexto_campania,
            evaluacion_creativa: this.compassData.evaluacion_creativa,
            geo_intelligence: this.compassData.geo_intelligence,
          });
          const channelResponseRaw = await firstValueFrom(
            this.apiCallsService.generateChannelIntelligence(
              contextParcial,
              this.curatedChannels
            )
          );
          const channelData = JSON.parse(channelResponseRaw);
          const contextos = Array.isArray(channelData) ? channelData : (channelData.contextos || []);
          this.compassData.channel_intelligence = {
            pregunta: '¿En qué contextos funciona mejor el contenido?',
            contextos,
          };
        } catch (channelError) {
          console.error('Compass: Channel Intelligence step failed (non-fatal)', channelError);
          this.compassData.channel_intelligence = null;
        }
      }

      // ── PASO 6 (REAL): Priorizando Insights ────────────────────────────────
      this.advanceStep(6);
      try {
        const fullContextJson = JSON.stringify(this.compassData);
        const priorResponseRaw = await firstValueFrom(
          this.apiCallsService.generatePrioritization(fullContextJson)
        );
        const priorData = JSON.parse(priorResponseRaw);
        const oportunidades = Array.isArray(priorData) ? priorData : (priorData.oportunidades || []);
        this.compassData.prioridades = {
          pregunta: '¿Qué debería hacer ahora?',
          oportunidades,
        };
      } catch (priorError) {
        console.error('Compass: Prioritization step failed (non-fatal)', priorError);
        this.compassData.prioridades = null;
      }

      // ── PASO 7 (SIMULADO): Generando Compass Insights ──────────────────────
      this.advanceStep(7);
      this.compassJson = JSON.stringify(this.compassData, null, 2);

      // Breve pausa visual antes de habilitar el botón final
      await new Promise(resolve => setTimeout(resolve, 1200));
      this.isAnalysisComplete = true;
      this.cdRef.detectChanges();

    } catch (error: any) {
      console.error('Compass: Pipeline failed at step', this.currentProgressStep, error);
      this.compassStepError = error?.message || 'Error inesperado en el análisis.';
      this.loading = false;
      this.generatingVariants = false;
      this.isAnalysisInProgress = false;
      alert('Error en el análisis. Por favor inténtalo de nuevo.');
    }
  }

  getAbcdScorePercentage(): number {
    if (!this.fullVideoEvaluationResult) return 0;
    // The AI is now instructed to return a score out of 100 directly.
    return this.fullVideoEvaluationResult.score || 0;
  }

  getAbcdScoreBadge(): string {
    const percentage = this.getAbcdScorePercentage();
    if (percentage === 0) return 'Sin Evaluar';
    if (percentage >= 90) return 'Excelente';
    if (percentage >= 75) return 'Bueno';
    if (percentage >= 50) return 'Regular';
    return 'Mejorable';
  }

  getAbcdScoreColorClass(): string {
    const percentage = this.getAbcdScorePercentage();
    if (percentage === 0) return 'gray';
    if (percentage >= 75) return 'green';
    if (percentage >= 50) return 'orange';
    return 'red';
  }

  generateVariants() {
    console.log('Component: generateVariants() called');
    this.loading = true;
    this.generatingVariants = true;

    // Set a timeout warning after 30 seconds
    const timeoutWarning = setTimeout(() => {
      console.warn('WARNING: Variant generation is taking longer than 30 seconds. This may indicate a timeout issue.');
    }, 30000);

    this.apiCallsService
      .generateVariants(this.folder, {
        prompt: this.prompt || this.defaultPrompt,
        evalPrompt: this.evalPrompt,
        duration: this.duration,
        demandGenAssets: this.demandGenAssets,
        shortenVideo: this.shortenVideo,
        // Pass brand params when at least one field is filled
        ...(this.brandName || this.advertiserName || this.country || this.brandColor || this.brandColor2 || this.brandColor3 || this.communicationTone
          ? {
            brandParams: {
              brandName: this.brandName,
              advertiserName: this.advertiserName,
              country: this.country,
              brandColor: this.brandColor,
              brandColor2: this.brandColor2,
              brandColor3: this.brandColor3,
              communicationTone: this.communicationTone,
            },
          }
          : {}),
      })
      .subscribe({
        next: variants => {
          clearTimeout(timeoutWarning);
          try {
            console.log('Component: Received variants in subscribe handler');
            console.log('Received variants:', variants);
            console.log('Number of variants:', variants?.length);
            this.loading = false;
            this.generatingVariants = false;
            this.selectedVariant = 0;
            this.variants = variants.map(v => {
              if (v.av_segments) {
                v.av_segments.forEach((seg: any) => {
                  if (seg.segment_screenshot_uri) {
                    seg.segment_screenshot_uri = seg.segment_screenshot_uri.replace('storage.mtls.cloud.google.com', 'storage.googleapis.com');
                  }
                  if (seg.segment_uri) {
                    seg.segment_uri = seg.segment_uri.replace('storage.mtls.cloud.google.com', 'storage.googleapis.com');
                  }
                });
              }
              return v;
            });
            console.log('Set this.variants to:', this.variants);
            console.log('Component state - loading:', this.loading, 'generatingVariants:', this.generatingVariants);
            this.setSelectedSegments();
            console.log('Successfully processed variants');
            // Force Angular change detection
            this.cdRef.detectChanges();
          } catch (error) {
            console.error('Error processing variants:', error);
            this.failHandler(error instanceof Error ? error : new Error(String(error)));
          }
        },
        error: err => {
          clearTimeout(timeoutWarning);
          console.error('Component: Error in subscribe handler:', err);
          this.failHandler(err);
        },
      });
    console.log('Component: Subscribe call completed');
  }

  toggleYoutubeCategory(category: string) {
    const idx = this.youtubeSelectedCategories.indexOf(category);
    if (idx > -1) {
      this.youtubeSelectedCategories.splice(idx, 1);
    } else {
      this.youtubeSelectedCategories.push(category);
    }
  }

  get currentCarouselImages() {
    return this.relevantScreenshots.slice(this.carouselIndex, this.carouselIndex + 3);
  }

  nextCarouselPage() {
    if (this.carouselIndex + 3 < this.relevantScreenshots.length) {
      this.carouselIndex += 3;
    }
  }

  prevCarouselPage() {
    if (this.carouselIndex - 3 >= 0) {
      this.carouselIndex -= 3;
    } else {
      this.carouselIndex = 0;
    }
  }

  // ── Geo CSV clustering ─────────────────────────────────────────────────────

  private readonly GEO_COUNTRIES: Array<{
    name: string;
    latMin: number; latMax: number;
    lngMin: number; lngMax: number;
  }> = [
      { name: 'México', latMin: 14.5, latMax: 32.7, lngMin: -118.4, lngMax: -86.7 },
      { name: 'Colombia', latMin: -4.2, latMax: 12.5, lngMin: -79.0, lngMax: -66.8 },
      { name: 'Argentina', latMin: -55.0, latMax: -21.8, lngMin: -73.6, lngMax: -53.6 },
      { name: 'Brasil', latMin: -33.7, latMax: 5.3, lngMin: -73.9, lngMax: -34.8 },
      { name: 'Chile', latMin: -55.9, latMax: -17.5, lngMin: -75.6, lngMax: -66.4 },
      { name: 'Perú', latMin: -18.3, latMax: 0.0, lngMin: -81.3, lngMax: -68.7 },
      { name: 'Ecuador', latMin: -5.0, latMax: 1.4, lngMin: -81.0, lngMax: -75.2 },
      { name: 'Venezuela', latMin: 0.7, latMax: 12.2, lngMin: -73.4, lngMax: -59.8 },
      { name: 'Bolivia', latMin: -22.9, latMax: -9.7, lngMin: -69.6, lngMax: -57.5 },
      { name: 'Paraguay', latMin: -27.6, latMax: -19.3, lngMin: -62.6, lngMax: -54.3 },
      { name: 'Uruguay', latMin: -34.9, latMax: -30.1, lngMin: -58.4, lngMax: -53.1 },
      { name: 'Panamá', latMin: 7.2, latMax: 9.6, lngMin: -83.0, lngMax: -77.2 },
      { name: 'Costa Rica', latMin: 8.0, latMax: 11.2, lngMin: -85.9, lngMax: -82.6 },
      { name: 'Guatemala', latMin: 13.7, latMax: 17.8, lngMin: -92.2, lngMax: -88.2 },
      { name: 'Honduras', latMin: 13.0, latMax: 16.0, lngMin: -89.4, lngMax: -83.1 },
      { name: 'El Salvador', latMin: 13.1, latMax: 14.5, lngMin: -90.1, lngMax: -87.7 },
      { name: 'Nicaragua', latMin: 10.7, latMax: 15.0, lngMin: -87.7, lngMax: -82.6 },
      { name: 'Cuba', latMin: 19.8, latMax: 23.3, lngMin: -85.0, lngMax: -73.9 },
      { name: 'República Dominicana', latMin: 17.5, latMax: 19.9, lngMin: -72.0, lngMax: -68.3 },
      { name: 'Puerto Rico', latMin: 17.9, latMax: 18.5, lngMin: -67.3, lngMax: -65.6 },
      { name: 'Estados Unidos', latMin: 24.5, latMax: 49.4, lngMin: -124.8, lngMax: -66.9 },
      { name: 'España', latMin: 36.0, latMax: 43.8, lngMin: -9.3, lngMax: 3.3 },
    ];

  private getCountryFromCoords(lat: number, lng: number): string {
    for (const c of this.GEO_COUNTRIES) {
      if (lat >= c.latMin && lat <= c.latMax && lng >= c.lngMin && lng <= c.lngMax) {
        return c.name;
      }
    }
    return 'Desconocido';
  }

  // Lookup table: major cities per country with approx centroid lat/lng
  private readonly GEO_CITIES: Array<{ city: string; state: string; country: string; lat: number; lng: number }> = [
    // ── México ──────────────────────────────────────────────────────────
    { city: 'Ciudad de México', state: 'CDMX', country: 'México', lat: 19.43, lng: -99.13 },
    { city: 'Ecatepec', state: 'Estado de México', country: 'México', lat: 19.60, lng: -99.05 },
    { city: 'Nezahualcóyotl', state: 'Estado de México', country: 'México', lat: 19.40, lng: -98.98 },
    { city: 'Naucalpan', state: 'Estado de México', country: 'México', lat: 19.48, lng: -99.24 },
    { city: 'Tlalnepantla', state: 'Estado de México', country: 'México', lat: 19.53, lng: -99.20 },
    { city: 'Texcoco', state: 'Estado de México', country: 'México', lat: 19.51, lng: -98.88 },
    { city: 'Toluca', state: 'Estado de México', country: 'México', lat: 19.29, lng: -99.66 },
    { city: 'Guadalajara', state: 'Jalisco', country: 'México', lat: 20.68, lng: -103.35 },
    { city: 'Zapopan', state: 'Jalisco', country: 'México', lat: 20.72, lng: -103.39 },
    { city: 'Tlaquepaque', state: 'Jalisco', country: 'México', lat: 20.64, lng: -103.31 },
    { city: 'Puerto Vallarta', state: 'Jalisco', country: 'México', lat: 20.65, lng: -105.22 },
    { city: 'Monterrey', state: 'Nuevo León', country: 'México', lat: 25.67, lng: -100.31 },
    { city: 'San Nicolás', state: 'Nuevo León', country: 'México', lat: 25.74, lng: -100.30 },
    { city: 'Guadalupe', state: 'Nuevo León', country: 'México', lat: 25.68, lng: -100.26 },
    { city: 'Apodaca', state: 'Nuevo León', country: 'México', lat: 25.78, lng: -100.19 },
    { city: 'Puebla', state: 'Puebla', country: 'México', lat: 19.04, lng: -98.20 },
    { city: 'Tehuacán', state: 'Puebla', country: 'México', lat: 18.47, lng: -97.39 },
    { city: 'Mérida', state: 'Yucatán', country: 'México', lat: 20.97, lng: -89.62 },
    { city: 'Valladolid', state: 'Yucatán', country: 'México', lat: 20.69, lng: -88.20 },
    { city: 'Cancún', state: 'Quintana Roo', country: 'México', lat: 21.17, lng: -86.85 },
    { city: 'Playa del Carmen', state: 'Quintana Roo', country: 'México', lat: 20.63, lng: -87.08 },
    { city: 'Tulum', state: 'Quintana Roo', country: 'México', lat: 20.21, lng: -87.46 },
    { city: 'Chetumal', state: 'Quintana Roo', country: 'México', lat: 18.50, lng: -88.30 },
    { city: 'Cozumel', state: 'Quintana Roo', country: 'México', lat: 20.51, lng: -86.94 },
    { city: 'Tuxtla Gutiérrez', state: 'Chiapas', country: 'México', lat: 16.75, lng: -93.12 },
    { city: 'San Cristóbal de las Casas', state: 'Chiapas', country: 'México', lat: 16.74, lng: -92.64 },
    { city: 'Tapachula', state: 'Chiapas', country: 'México', lat: 14.91, lng: -92.26 },
    { city: 'Comitán', state: 'Chiapas', country: 'México', lat: 16.25, lng: -92.13 },
    { city: 'Veracruz', state: 'Veracruz', country: 'México', lat: 19.17, lng: -96.13 },
    { city: 'Xalapa', state: 'Veracruz', country: 'México', lat: 19.54, lng: -96.92 },
    { city: 'Coatzacoalcos', state: 'Veracruz', country: 'México', lat: 18.15, lng: -94.45 },
    { city: 'Orizaba', state: 'Veracruz', country: 'México', lat: 18.85, lng: -97.10 },
    { city: 'Poza Rica', state: 'Veracruz', country: 'México', lat: 20.54, lng: -97.45 },
    { city: 'Acapulco', state: 'Guerrero', country: 'México', lat: 16.86, lng: -99.89 },
    { city: 'Chilpancingo', state: 'Guerrero', country: 'México', lat: 17.55, lng: -99.50 },
    { city: 'Iguala', state: 'Guerrero', country: 'México', lat: 18.35, lng: -99.54 },
    { city: 'Zihuatanejo', state: 'Guerrero', country: 'México', lat: 17.64, lng: -101.55 },
    { city: 'Oaxaca', state: 'Oaxaca', country: 'México', lat: 17.06, lng: -96.72 },
    { city: 'Salina Cruz', state: 'Oaxaca', country: 'México', lat: 16.17, lng: -95.19 },
    { city: 'Juchitán', state: 'Oaxaca', country: 'México', lat: 16.43, lng: -95.02 },
    { city: 'Villahermosa', state: 'Tabasco', country: 'México', lat: 17.99, lng: -92.93 },
    { city: 'Campeche', state: 'Campeche', country: 'México', lat: 19.84, lng: -90.53 },
    { city: 'Ciudad del Carmen', state: 'Campeche', country: 'México', lat: 18.65, lng: -91.82 },
    { city: 'Tampico', state: 'Tamaulipas', country: 'México', lat: 22.27, lng: -97.85 },
    { city: 'Matamoros', state: 'Tamaulipas', country: 'México', lat: 25.87, lng: -97.51 },
    { city: 'Reynosa', state: 'Tamaulipas', country: 'México', lat: 26.08, lng: -98.30 },
    { city: 'Nuevo Laredo', state: 'Tamaulipas', country: 'México', lat: 27.48, lng: -99.51 },
    { city: 'Ciudad Victoria', state: 'Tamaulipas', country: 'México', lat: 23.74, lng: -99.14 },
    { city: 'Saltillo', state: 'Coahuila', country: 'México', lat: 25.42, lng: -101.00 },
    { city: 'Torreón', state: 'Coahuila', country: 'México', lat: 25.54, lng: -103.45 },
    { city: 'Monclova', state: 'Coahuila', country: 'México', lat: 26.91, lng: -101.42 },
    { city: 'Piedras Negras', state: 'Coahuila', country: 'México', lat: 28.70, lng: -100.52 },
    { city: 'Chihuahua', state: 'Chihuahua', country: 'México', lat: 28.63, lng: -106.09 },
    { city: 'Ciudad Juárez', state: 'Chihuahua', country: 'México', lat: 31.73, lng: -106.49 },
    { city: 'Hermosillo', state: 'Sonora', country: 'México', lat: 29.07, lng: -110.95 },
    { city: 'Ciudad Obregón', state: 'Sonora', country: 'México', lat: 27.49, lng: -109.94 },
    { city: 'Nogales', state: 'Sonora', country: 'México', lat: 31.32, lng: -110.95 },
    { city: 'Culiacán', state: 'Sinaloa', country: 'México', lat: 24.80, lng: -107.39 },
    { city: 'Mazatlán', state: 'Sinaloa', country: 'México', lat: 23.23, lng: -106.41 },
    { city: 'Los Mochis', state: 'Sinaloa', country: 'México', lat: 25.79, lng: -108.99 },
    { city: 'Tepic', state: 'Nayarit', country: 'México', lat: 21.50, lng: -104.89 },
    { city: 'Morelia', state: 'Michoacán', country: 'México', lat: 19.70, lng: -101.19 },
    { city: 'Uruapan', state: 'Michoacán', country: 'México', lat: 19.42, lng: -102.06 },
    { city: 'Zamora', state: 'Michoacán', country: 'México', lat: 19.98, lng: -102.28 },
    { city: 'León', state: 'Guanajuato', country: 'México', lat: 21.12, lng: -101.67 },
    { city: 'Irapuato', state: 'Guanajuato', country: 'México', lat: 20.67, lng: -101.35 },
    { city: 'Celaya', state: 'Guanajuato', country: 'México', lat: 20.52, lng: -100.82 },
    { city: 'Guanajuato', state: 'Guanajuato', country: 'México', lat: 21.02, lng: -101.26 },
    { city: 'San Luis Potosí', state: 'San Luis Potosí', country: 'México', lat: 22.15, lng: -100.98 },
    { city: 'Aguascalientes', state: 'Aguascalientes', country: 'México', lat: 21.88, lng: -102.29 },
    { city: 'Zacatecas', state: 'Zacatecas', country: 'México', lat: 22.77, lng: -102.57 },
    { city: 'Fresnillo', state: 'Zacatecas', country: 'México', lat: 23.17, lng: -102.88 },
    { city: 'Durango', state: 'Durango', country: 'México', lat: 24.02, lng: -104.66 },
    { city: 'Tijuana', state: 'Baja California', country: 'México', lat: 32.51, lng: -117.04 },
    { city: 'Ensenada', state: 'Baja California', country: 'México', lat: 31.87, lng: -116.60 },
    { city: 'Mexicali', state: 'Baja California', country: 'México', lat: 32.66, lng: -115.47 },
    { city: 'La Paz', state: 'Baja California Sur', country: 'México', lat: 24.14, lng: -110.31 },
    { city: 'Los Cabos', state: 'Baja California Sur', country: 'México', lat: 22.88, lng: -109.92 },
    { city: 'Querétaro', state: 'Querétaro', country: 'México', lat: 20.59, lng: -100.39 },
    { city: 'Pachuca', state: 'Hidalgo', country: 'México', lat: 20.12, lng: -98.73 },
    { city: 'Tulancingo', state: 'Hidalgo', country: 'México', lat: 20.09, lng: -98.36 },
    { city: 'Cuernavaca', state: 'Morelos', country: 'México', lat: 18.92, lng: -99.23 },
    { city: 'Cuautla', state: 'Morelos', country: 'México', lat: 18.80, lng: -98.95 },
    { city: 'Tlaxcala', state: 'Tlaxcala', country: 'México', lat: 19.31, lng: -98.23 },
    { city: 'Colima', state: 'Colima', country: 'México', lat: 19.24, lng: -103.72 },
    { city: 'Manzanillo', state: 'Colima', country: 'México', lat: 19.05, lng: -104.31 },
    // ── Colombia ────────────────────────────────────────────────────────
    { city: 'Bogotá', state: 'Cundinamarca', country: 'Colombia', lat: 4.71, lng: -74.07 },
    { city: 'Medellín', state: 'Antioquia', country: 'Colombia', lat: 6.24, lng: -75.57 },
    { city: 'Cali', state: 'Valle del Cauca', country: 'Colombia', lat: 3.43, lng: -76.52 },
    { city: 'Barranquilla', state: 'Atlántico', country: 'Colombia', lat: 10.96, lng: -74.80 },
    { city: 'Cartagena', state: 'Bolívar', country: 'Colombia', lat: 10.39, lng: -75.48 },
    { city: 'Cúcuta', state: 'Norte de Santander', country: 'Colombia', lat: 7.90, lng: -72.51 },
    { city: 'Bucaramanga', state: 'Santander', country: 'Colombia', lat: 7.13, lng: -73.13 },
    { city: 'Pereira', state: 'Risaralda', country: 'Colombia', lat: 4.81, lng: -75.69 },
    { city: 'Santa Marta', state: 'Magdalena', country: 'Colombia', lat: 11.24, lng: -74.20 },
    { city: 'Ibagué', state: 'Tolima', country: 'Colombia', lat: 4.43, lng: -75.23 },
    { city: 'Pasto', state: 'Nariño', country: 'Colombia', lat: 1.21, lng: -77.28 },
    { city: 'Manizales', state: 'Caldas', country: 'Colombia', lat: 5.06, lng: -75.51 },
    // ── Argentina ───────────────────────────────────────────────────────
    { city: 'Buenos Aires', state: 'Buenos Aires', country: 'Argentina', lat: -34.60, lng: -58.38 },
    { city: 'Córdoba', state: 'Córdoba', country: 'Argentina', lat: -31.42, lng: -64.19 },
    { city: 'Rosario', state: 'Santa Fe', country: 'Argentina', lat: -32.95, lng: -60.64 },
    { city: 'Mendoza', state: 'Mendoza', country: 'Argentina', lat: -32.89, lng: -68.85 },
    { city: 'San Miguel de Tucumán', state: 'Tucumán', country: 'Argentina', lat: -26.82, lng: -65.22 },
    { city: 'La Plata', state: 'Buenos Aires', country: 'Argentina', lat: -34.92, lng: -57.95 },
    { city: 'Mar del Plata', state: 'Buenos Aires', country: 'Argentina', lat: -38.00, lng: -57.55 },
    { city: 'Salta', state: 'Salta', country: 'Argentina', lat: -24.78, lng: -65.41 },
    { city: 'Santa Fe', state: 'Santa Fe', country: 'Argentina', lat: -31.63, lng: -60.70 },
    // ── Brasil ──────────────────────────────────────────────────────────
    { city: 'São Paulo', state: 'São Paulo', country: 'Brasil', lat: -23.55, lng: -46.63 },
    { city: 'Rio de Janeiro', state: 'Rio de Janeiro', country: 'Brasil', lat: -22.91, lng: -43.17 },
    { city: 'Brasília', state: 'Distrito Federal', country: 'Brasil', lat: -15.78, lng: -47.93 },
    { city: 'Salvador', state: 'Bahia', country: 'Brasil', lat: -12.97, lng: -38.50 },
    { city: 'Fortaleza', state: 'Ceará', country: 'Brasil', lat: -3.73, lng: -38.52 },
    { city: 'Belo Horizonte', state: 'Minas Gerais', country: 'Brasil', lat: -19.92, lng: -43.93 },
    { city: 'Manaus', state: 'Amazonas', country: 'Brasil', lat: -3.11, lng: -60.02 },
    { city: 'Curitiba', state: 'Paraná', country: 'Brasil', lat: -25.42, lng: -49.27 },
    { city: 'Recife', state: 'Pernambuco', country: 'Brasil', lat: -8.04, lng: -34.87 },
    { city: 'Porto Alegre', state: 'Rio Grande do Sul', country: 'Brasil', lat: -30.03, lng: -51.23 },
    // ── Chile ───────────────────────────────────────────────────────────
    { city: 'Santiago', state: 'Metropolitana', country: 'Chile', lat: -33.46, lng: -70.65 },
    { city: 'Valparaíso', state: 'Valparaíso', country: 'Chile', lat: -33.04, lng: -71.62 },
    { city: 'Viña del Mar', state: 'Valparaíso', country: 'Chile', lat: -33.02, lng: -71.55 },
    { city: 'Concepción', state: 'Biobío', country: 'Chile', lat: -36.82, lng: -73.05 },
    { city: 'Antofagasta', state: 'Antofagasta', country: 'Chile', lat: -23.65, lng: -70.39 },
    { city: 'Temuco', state: 'Araucanía', country: 'Chile', lat: -38.73, lng: -72.59 },
    { city: 'Iquique', state: 'Tarapacá', country: 'Chile', lat: -20.21, lng: -70.14 },
    { city: 'Puerto Montt', state: 'Los Lagos', country: 'Chile', lat: -41.46, lng: -72.94 },
    // ── Perú ────────────────────────────────────────────────────────────
    { city: 'Lima', state: 'Lima', country: 'Perú', lat: -12.05, lng: -77.04 },
    { city: 'Arequipa', state: 'Arequipa', country: 'Perú', lat: -16.41, lng: -71.54 },
    { city: 'Trujillo', state: 'La Libertad', country: 'Perú', lat: -8.11, lng: -79.03 },
    { city: 'Chiclayo', state: 'Lambayeque', country: 'Perú', lat: -6.77, lng: -79.84 },
    { city: 'Piura', state: 'Piura', country: 'Perú', lat: -5.19, lng: -80.62 },
    { city: 'Cusco', state: 'Cusco', country: 'Perú', lat: -13.53, lng: -71.96 },
    { city: 'Iquitos', state: 'Loreto', country: 'Perú', lat: -3.74, lng: -73.25 },
    { city: 'Huancayo', state: 'Junín', country: 'Perú', lat: -12.06, lng: -75.21 },
    // ── Ecuador ─────────────────────────────────────────────────────────
    { city: 'Guayaquil', state: 'Guayas', country: 'Ecuador', lat: -2.18, lng: -79.88 },
    { city: 'Quito', state: 'Pichincha', country: 'Ecuador', lat: -0.22, lng: -78.52 },
    { city: 'Cuenca', state: 'Azuay', country: 'Ecuador', lat: -2.90, lng: -79.00 },
    { city: 'Santo Domingo', state: 'Santo Domingo', country: 'Ecuador', lat: -0.25, lng: -79.16 },
    { city: 'Machala', state: 'El Oro', country: 'Ecuador', lat: -3.25, lng: -79.95 },
    // ── Venezuela ───────────────────────────────────────────────────────
    { city: 'Caracas', state: 'Distrito Capital', country: 'Venezuela', lat: 10.48, lng: -66.90 },
    { city: 'Maracaibo', state: 'Zulia', country: 'Venezuela', lat: 10.64, lng: -71.61 },
    { city: 'Valencia', state: 'Carabobo', country: 'Venezuela', lat: 10.16, lng: -68.00 },
    { city: 'Barquisimeto', state: 'Lara', country: 'Venezuela', lat: 10.06, lng: -69.31 },
    { city: 'Maracay', state: 'Aragua', country: 'Venezuela', lat: 10.24, lng: -67.59 },
    // ── Bolivia ─────────────────────────────────────────────────────────
    { city: 'Santa Cruz', state: 'Santa Cruz', country: 'Bolivia', lat: -17.78, lng: -63.18 },
    { city: 'La Paz', state: 'La Paz', country: 'Bolivia', lat: -16.48, lng: -68.11 },
    { city: 'Cochabamba', state: 'Cochabamba', country: 'Bolivia', lat: -17.39, lng: -66.15 },
    { city: 'Sucre', state: 'Chuquisaca', country: 'Bolivia', lat: -19.03, lng: -65.26 },
    // ── Uruguay y Paraguay ──────────────────────────────────────────────
    { city: 'Montevideo', state: 'Montevideo', country: 'Uruguay', lat: -34.90, lng: -56.16 },
    { city: 'Salto', state: 'Salto', country: 'Uruguay', lat: -31.38, lng: -57.96 },
    { city: 'Asunción', state: 'Asunción', country: 'Paraguay', lat: -25.26, lng: -57.63 },
    { city: 'Ciudad del Este', state: 'Alto Paraná', country: 'Paraguay', lat: -25.50, lng: -54.61 },
    // ── Centroamérica y Caribe ──────────────────────────────────────────
    { city: 'Ciudad de Panamá', state: 'Panamá', country: 'Panamá', lat: 8.98, lng: -79.51 },
    { city: 'San José', state: 'San José', country: 'Costa Rica', lat: 9.92, lng: -84.08 },
    { city: 'Ciudad de Guatemala', state: 'Guatemala', country: 'Guatemala', lat: 14.63, lng: -90.52 },
    { city: 'Tegucigalpa', state: 'Francisco Morazán', country: 'Honduras', lat: 14.08, lng: -87.20 },
    { city: 'San Pedro Sula', state: 'Cortés', country: 'Honduras', lat: 15.50, lng: -88.02 },
    { city: 'San Salvador', state: 'San Salvador', country: 'El Salvador', lat: 13.69, lng: -89.19 },
    { city: 'Managua', state: 'Managua', country: 'Nicaragua', lat: 12.13, lng: -86.25 },
    { city: 'La Habana', state: 'La Habana', country: 'Cuba', lat: 23.11, lng: -82.36 },
    { city: 'Santo Domingo', state: 'Distrito Nacional', country: 'República Dominicana', lat: 18.48, lng: -69.93 },
    { city: 'Santiago', state: 'Santiago', country: 'República Dominicana', lat: 19.45, lng: -70.69 },
    { city: 'San Juan', state: 'San Juan', country: 'Puerto Rico', lat: 18.46, lng: -66.10 },
    // ── España ──────────────────────────────────────────────────────────
    { city: 'Madrid', state: 'Comunidad de Madrid', country: 'España', lat: 40.41, lng: -3.70 },
    { city: 'Barcelona', state: 'Cataluña', country: 'España', lat: 41.38, lng: 2.16 },
    { city: 'Valencia', state: 'Comunidad Valenciana', country: 'España', lat: 39.46, lng: -0.37 },
    { city: 'Sevilla', state: 'Andalucía', country: 'España', lat: 37.38, lng: -5.98 },
    // ── Estados Unidos (Top Mercados Hispanos) ──────────────────────────
    { city: 'Los Ángeles', state: 'California', country: 'Estados Unidos', lat: 34.05, lng: -118.24 },
    { city: 'Nueva York', state: 'Nueva York', country: 'Estados Unidos', lat: 40.71, lng: -74.01 },
    { city: 'Miami', state: 'Florida', country: 'Estados Unidos', lat: 25.77, lng: -80.19 },
    { city: 'Houston', state: 'Texas', country: 'Estados Unidos', lat: 29.76, lng: -95.37 },
    { city: 'San Antonio', state: 'Texas', country: 'Estados Unidos', lat: 29.42, lng: -98.49 },
    { city: 'Dallas', state: 'Texas', country: 'Estados Unidos', lat: 32.78, lng: -96.80 },
    { city: 'El Paso', state: 'Texas', country: 'Estados Unidos', lat: 31.76, lng: -106.49 },
    { city: 'San Diego', state: 'California', country: 'Estados Unidos', lat: 32.72, lng: -117.16 },
    { city: 'Chicago', state: 'Illinois', country: 'Estados Unidos', lat: 41.87, lng: -87.62 },
    { city: 'Phoenix', state: 'Arizona', country: 'Estados Unidos', lat: 33.44, lng: -112.07 },
  ];

  private getNearestCity(lat: number, lng: number, country: string): string {
    const candidates = this.GEO_CITIES.filter(c => c.country === country);
    if (candidates.length === 0) return `(${lat}, ${lng})`;
    let best = candidates[0];
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return `${best.city}, ${best.state}`;
  }

  private clusterGeoCoordinates(csvText: string): string {
    const MAX_CITY_ZONES = 25;  // top cities per country
    const MAX_STATE_ZONES = 10;  // top states/regions per country

    const rows = csvText.split('\n').filter((l: string) => l.trim());

    // Parse lat/lng — find first pair of numeric cols where |lat|≤90, |lng|≤180
    const points: Array<{ lat: number; lng: number; country: string }> = [];
    for (const row of rows) {
      const cols = row.split(',');
      for (let i = 0; i < cols.length - 1; i++) {
        const a = parseFloat(cols[i]);
        const b = parseFloat(cols[i + 1]);
        if (!isNaN(a) && !isNaN(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) {
          points.push({ lat: a, lng: b, country: this.getCountryFromCoords(a, b) });
          break;
        }
      }
    }

    if (points.length === 0) {
      return 'No se encontraron coordenadas válidas en el archivo.';
    }

    // Group by country
    const byCountry: Record<string, Array<{ lat: number; lng: number }>> = {};
    for (const p of points) {
      if (!byCountry[p.country]) byCountry[p.country] = [];
      byCountry[p.country].push({ lat: p.lat, lng: p.lng });
    }

    const summaryLines: string[] = [
      `PRE-ANÁLISIS DE DENSIDAD GEOGRÁFICA`,
      `Total de puntos procesados: ${points.length.toLocaleString()}`,
      `Países detectados: ${Object.keys(byCountry).filter(k => k !== 'Desconocido').join(', ')}`,
      '',
    ];

    for (const [country, pts] of Object.entries(byCountry)) {
      if (country === 'Desconocido') continue;

      // ── NIVEL ESTADO (~111km grid — 0 decimales) ──────────────────────
      const stateGrid: Record<string, { lat: number; lng: number; count: number }> = {};
      for (const p of pts) {
        const gLat = Math.round(p.lat);
        const gLng = Math.round(p.lng);
        const key = `${gLat},${gLng}`;
        if (stateGrid[key]) { stateGrid[key].count++; }
        else { stateGrid[key] = { lat: gLat, lng: gLng, count: 1 }; }
      }
      const topStates = Object.values(stateGrid)
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_STATE_ZONES);

      // ── NIVEL CIUDAD (~11km grid — 1 decimal) ─────────────────────────
      const cityGrid: Record<string, { lat: number; lng: number; count: number }> = {};
      for (const p of pts) {
        const gLat = Math.round(p.lat * 10) / 10;
        const gLng = Math.round(p.lng * 10) / 10;
        const key = `${gLat},${gLng}`;
        if (cityGrid[key]) { cityGrid[key].count++; }
        else { cityGrid[key] = { lat: gLat, lng: gLng, count: 1 }; }
      }
      const topCities = Object.values(cityGrid)
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_CITY_ZONES);

      const pct = (n: number) => ((n / pts.length) * 100).toFixed(1);

      summaryLines.push(`══════════════════════════════════════`);
      summaryLines.push(`PAÍS: ${country} — ${pts.length.toLocaleString()} puntos totales`);
      summaryLines.push('');

      summaryLines.push(`▸ DISTRIBUCIÓN POR REGIÓN (grandes áreas ~100km):`);
      const seenRegions = new Set<string>();
      let regionRank = 1;
      for (const z of topStates) {
        const label = this.getNearestCity(z.lat, z.lng, country);
        if (!seenRegions.has(label)) {
          seenRegions.add(label);
          summaryLines.push(`  ${regionRank++}. ${label} (${z.lat}°, ${z.lng}°) — ${z.count.toLocaleString()} pts (${pct(z.count)}%)`);
        }
        if (regionRank > MAX_STATE_ZONES) break;
      }

      summaryLines.push('');
      summaryLines.push(`▸ CONCENTRACIÓN POR ZONA (~10km por celda, top ${MAX_CITY_ZONES}):`);
      const seenCities = new Set<string>();
      let cityRank = 1;
      for (const z of topCities) {
        const label = this.getNearestCity(z.lat, z.lng, country);
        if (!seenCities.has(label)) {
          seenCities.add(label);
          summaryLines.push(`  ${cityRank++}. ${label} (${z.lat}, ${z.lng}) — ${z.count.toLocaleString()} pts (${pct(z.count)}%)`);
        }
        if (cityRank > MAX_CITY_ZONES) break;
      }
      summaryLines.push('');
    }

    return summaryLines.join('\n');
  }



  clearGeoCsv() {
    this.geoCsvSummary = '';
    this.geoCsvLineCount = 0;
    const input = document.getElementById('geo-csv-input') as HTMLInputElement;
    if (input) input.value = '';
  }

  // ── End Geo CSV clustering ─────────────────────────────────────────────────

  onGenerateYoutubeIdeas() {
    this.isGeneratingYoutubeIdeas = true;
    this.youtubeIdeasResponse = null;
    this.relevantScreenshots = [];
    this.carouselIndex = 0;

    const resolvedValue = this.youtubePersonalizationMode === 'geokey'
      ? this.youtubeGeoCoordinates
      : this.youtubeSelectedCategories.join(', ');

    this.apiCallsService
      .generateYoutubeIdeas(
        this.folder,
        this.selectedFullVideoObjective,
        this.youtubeCustomPoints,
        this.youtubePersonalizationMode || '',
        resolvedValue,
        this.youtubeSelectedCategories,
        this.youtubePersonalizationMode === 'geokey' ? this.aiSummaryJson : undefined,
        this.youtubePersonalizationMode === 'geokey' ? this.microOpportunitiesJson : undefined
      )
      .subscribe({
        next: (responseStr) => {
          this.isGeneratingYoutubeIdeas = false;
          try {
            this.youtubeIdeasResponse = JSON.parse(responseStr) as YoutubeIdeasResponse;

            // Resolve screenshots from segments
            if (this.avSegments && this.youtubeIdeasResponse.relevant_frame_segment_indices) {
              this.youtubeIdeasResponse.relevant_frame_segment_indices.forEach(index => {
                const segment = this.avSegments![index];
                if (segment && segment.segment_screenshot_uri) {
                  this.relevantScreenshots.push(segment.segment_screenshot_uri);
                }
              });
            }
          } catch (e) {
            console.error('Failed to parse YouTube ideas JSON:', e, responseStr);
            this.failHandler(new Error('Failed to parse the response from the AI.'));
          }
          this.cdRef.detectChanges();
        },
        error: (err) => {
          this.isGeneratingYoutubeIdeas = false;
          console.error('Error generating YouTube ideas:', err);
          this.failHandler(err);
          this.cdRef.detectChanges();
        },
      });
  }

  // ─── Insights Report ────────────────────────────────────────────────────────

  buildInsightsPayload(): object {
    const now = new Date().toISOString();
    const sessionId = `VGR-${now.replace(/[^0-9]/g, '').slice(0, 14)}`;

    const segments = (this.avSegments || []).map((seg, i) => ({
      segment_id: `seg_${String(i + 1).padStart(2, '0')}`,
      index: i + 1,
      start_s: seg.start_s ?? null,
      end_s: seg.end_s ?? null,
      duration_s: (seg.end_s !== undefined && seg.start_s !== undefined)
        ? seg.end_s - seg.start_s : null
    }));

    const variantsMapped = (this.variants || []).map((v, i) => {
      const totalScore = v.score ?? 0;
      return {
        variant_id: i + 1,
        title: v.title || null,
        duration: v.duration || null,
        description: v.description || null,
        scenes: (v.av_segments || []).map((s: AvSegment) =>
          `seg_${String((s.av_segment_id ?? 0) + 1).padStart(2, '0')}`).join(', ') || null,
        abcd_evaluation: {
          total_score: totalScore,
          max_score: this.getMaxScore(),
          score_label: totalScore >= 13 ? 'Excelente potencial'
            : totalScore >= 9 ? 'Buen potencial' : 'Potencial limitado',
          pillars: {
            attention: { score_label: 'A', analysis: v.abcd?.attention || null },
            branding: { score_label: 'B', analysis: v.abcd?.branding || null },
            connection: { score_label: 'C', analysis: v.abcd?.connection || null },
            direction: { score_label: 'D', analysis: v.abcd?.direction || null }
          }
        }
      };
    });

    const bestVariant = variantsMapped.reduce(
      (best, v) => v.abcd_evaluation.total_score > best.abcd_evaluation.total_score ? v : best,
      variantsMapped[0] || { variant_id: null, abcd_evaluation: { total_score: 0 } }
    );

    const geo = this.youtubeIdeasResponse?.insights?.geoKeyInsights;
    const catIdeas = this.youtubeIdeasResponse?.insights?.categoryIdeas;
    const generalIdeas = this.youtubeIdeasResponse?.insights?.ideas;

    let totalIdeas = 0;

    const youtubeIdeation: any = {
      mode: this.youtubePersonalizationMode || null,
      abcd_objective: this.selectedFullVideoObjective || null,
      production_script: this.youtubeIdeasResponse?.creative_services_script || null
    };

    if (geo) {
      totalIdeas = (geo.zonas_de_audiencia || []).reduce(
        (sum: number, z: any) => sum + (z.ideas?.length || 0), 0);
      youtubeIdeation['geokey_data'] = {
        pais: geo.pais || null,
        ciudad: geo.ciudad || null,
        estrategia_geotargeting: geo.estrategia_geotargeting || null,
        zones: (geo.zonas_de_audiencia || []).map((zona: any) => ({
          cluster_id: zona.id_cluster || null,
          description: zona.descripcion || null,
          coordinates: zona.coordenadas_asociadas || null,
          nearby_landmarks: zona.sitios_aledanos || null,
          audience_profile: zona.perfil_audiencia_sugerido || null,
          creative_hooks: zona.ganchos_creativos_ctv || null,
          ideas: (zona.ideas || []).map((idea: any, idx: number) => ({
            index: idx + 1,
            title: idea.title || null,
            description: idea.description || null,
            format: idea.format || '15s pre-roll',
            hook: idea.hook || zona.ganchos_creativos_ctv?.[idx] || null,
            video_prompt: idea.video_prompt || null
          }))
        }))
      };
    } else if (catIdeas) {
      totalIdeas = Object.values(catIdeas).reduce((s: number, arr: any[]) => s + arr.length, 0);
      youtubeIdeation['category_data'] = Object.entries(catIdeas).map(([cat, ideas]: [string, any[]]) => ({
        category: cat,
        ideas: ideas.map((idea: any, idx: number) => ({
          index: idx + 1,
          title: idea.title || null,
          description: idea.description || null,
          format: idea.format || '15s pre-roll',
          hook: idea.hook || null,
          video_prompt: idea.video_prompt || null
        }))
      }));
    } else if (generalIdeas) {
      totalIdeas = generalIdeas.length;
      youtubeIdeation['general_ideas'] = generalIdeas.map((idea: any, idx: number) => ({
        index: idx + 1,
        title: idea.title || null,
        description: idea.description || null,
        format: idea.format || '15s pre-roll',
        hook: idea.hook || null,
        video_prompt: idea.video_prompt || null
      }));
    }

    return {
      metadata: {
        session_id: sessionId,
        generated_at: now,
        platform: 'WPP Media Solutions Creative Services',
        version: '1.0.0'
      },
      branding: {
        brand_name: this.brandName || null,
        advertiser_name: this.advertiserName || null,
        country: this.country || null,
        colors: {
          primary: this.brandColor || null,
          secondary: this.brandColor2 || null,
          tertiary: this.brandColor3 || null
        },
        communication_tone: this.communicationTone || null
      },
      video_analysis: {
        source_video: {
          gcs_bucket: CONFIG.cloudStorage.bucket || null,
          gcs_folder: this.folder || null,
          filename: this.folder
            ? `https://storage.googleapis.com/${CONFIG.cloudStorage.bucket}/${this.folder}/input.mp4`
            : null,
          duration_seconds: this.avSegments?.length
            ? (this.avSegments[this.avSegments.length - 1].end_s ?? null) : null
        },
        segments: segments.length ? segments : null
      },
      variants: variantsMapped.length ? variantsMapped : null,
      youtube_ideation: youtubeIdeation,
      export_summary: {
        total_segments_analyzed: segments.length,
        total_variants_generated: variantsMapped.length,
        best_variant_id: bestVariant?.variant_id || null,
        best_variant_score: bestVariant?.abcd_evaluation?.total_score || null,
        ideation_mode: this.youtubePersonalizationMode || null,
        total_geo_zones: geo?.zonas_de_audiencia?.length || null,
        total_ideas_generated: totalIdeas || null,
        report_generated_at: now
      }
    };
  }

  isLoadingInsightsReport = false;
  generatedReportUrl: string | null = null;

  logInsightsPayload() {
    try {
      const payload = this.buildInsightsPayload();
      console.log('--- JSON PAYLOAD DEBUG ---');
      console.log(JSON.stringify(payload, null, 2));
      this.snackBar.open('JSON impreso en la consola (F12)', 'OK', { duration: 3000 });
    } catch (e) {
      console.error('Error construyendo JSON payload:', e);
    }
  }

  viewInsightsReport() {
    this.isLoadingInsightsReport = true;
    this.cdRef.detectChanges();
    try {
      const payload = this.buildInsightsPayload();
      const apiUrl = 'https://cdn.nexus-creative-solutions.com/LATAM/applications/vigen-insights/api.php';
      const payloadStr = JSON.stringify(payload);

      console.log('--- ENVIANDO REPORTE A LA API ---');
      console.log('Payload (JSON):', payloadStr);

      fetch(apiUrl, {
        method: 'POST',
        // text/plain evita el CORS preflight OPTIONS — el backend lee con php://input
        headers: { 'Content-Type': 'text/plain' },
        body: payloadStr
      })
        .then(async res => {
          const text = await res.text();
          console.log('Raw response:', text);
          return text ? JSON.parse(text) : {};
        })
        .then((data: any) => {
          this.isLoadingInsightsReport = false;
          if (data.success && data.report_url) {
            this.generatedReportUrl = data.report_url;
            window.open(data.report_url, '_blank');
          } else {
            console.error('API error response:', data);
            this.snackBar.open('No se pudo generar el informe. Revisa la consola.', 'OK', { duration: 4000 });
          }
          this.cdRef.detectChanges();
        })
        .catch((err: any) => {
          this.isLoadingInsightsReport = false;
          console.error('Error en fetch al API de informe:', err);
          this.snackBar.open('Error de conexión con el servidor de informes.', 'OK', { duration: 4000 });
          this.cdRef.detectChanges();
        });
    } catch (e) {
      this.isLoadingInsightsReport = false;
      console.error('Error construyendo JSON payload:', e);
      this.snackBar.open('Error construyendo la data del informe.', 'OK', { duration: 4000 });
      this.cdRef.detectChanges();
    }
  }

  openGeneratedReport() {
    if (this.generatedReportUrl) {
      window.open(this.generatedReportUrl, '_blank');
    }
  }

  // ────────────────────────────────────────────────────────────────────────────

  generatePreviews(loading = false) {
    this.loading = loading;
    this.generatingPreviews = true;
    this.previewAnalyses = {};
    this.squareVideoObjects = this.verticalVideoObjects = undefined;
    this.apiCallsService
      .generatePreviews(this.folder, this.analysisJson, this.avSegments, {
        sourceDimensions: {
          w: Math.min(
            this.videoWidth,
            this.previewVideoElem.nativeElement.videoWidth
          ),
          h: Math.min(
            this.videoHeight,
            this.previewVideoElem.nativeElement.videoHeight
          ),
        },
        weights: {
          text: this.weightSteps[this.weightsTextIndex],
          face: this.weightSteps[this.weightsPersonFaceIndex],
          objects: {
            person: this.weightSteps[this.weightsPersonFaceIndex],
          },
        },
      })
      .subscribe({
        next: previews => {
          this.generatingPreviews = false;
          if (loading) {
            this.loading = false;
          }
          const previewFilter = (e: ObjectAnnotation) =>
            e.entity.description === 'crop-area';

          const parse = (jsonStr: string) =>
            this.parseAnalysis(JSON.parse(jsonStr) as VideoAnalysisJson, previewFilter);

          // Handle all format keys
          const squareData = previews['1:1'] || previews.square;
          if (squareData) {
            this.previewAnalyses['1:1'] = parse(squareData);
            this.squareVideoObjects = this.previewAnalyses['1:1'];
          }

          const verticalData = previews['9:16'] || previews.vertical;
          if (verticalData) {
            this.previewAnalyses['9:16'] = parse(verticalData);
            this.verticalVideoObjects = this.previewAnalyses['9:16'];
          }

          if (previews['16:9']) this.previewAnalyses['16:9'] = parse(previews['16:9']);
          if (previews['3:4']) this.previewAnalyses['3:4'] = parse(previews['3:4']);
          if (previews['4:3']) this.previewAnalyses['4:3'] = parse(previews['4:3']);
        },
        error: err => this.failHandler(err),
      });
  }

  toggleMoveCropArea() {
    this.segmentModeToggle.value = 'preview';
    this.moveCropArea = !this.moveCropArea;
    const { currentFrame, idx } = this.getCurrentCropAreaFrame(
      this.activeVideoObjects!
    )!;
    const canvasViewWidth = this.magicCanvas.nativeElement.scrollWidth;
    const canvasViewHeight = this.magicCanvas.nativeElement.scrollHeight;

    if (this.moveCropArea) {
      while (this.canvasDragElement?.nativeElement.firstChild) {
        this.canvasDragElement?.nativeElement.removeChild(
          this.canvasDragElement?.nativeElement.firstChild
        );
      }
      const outputX = (currentFrame.x * canvasViewWidth) / this.videoWidth;
      const outputWidth =
        (currentFrame.width * canvasViewWidth) / this.videoWidth;
      const outputHeight =
        (currentFrame.height * canvasViewHeight) / this.videoHeight;

      const img = document.createElement('img');
      img.src = this.magicCanvas.nativeElement.toDataURL('image/png');
      img.setAttribute(
        'style',
        `object-position: -${outputX}px; clip-path: rect(0px ${outputWidth}px ${outputHeight}px 0px); width: ${canvasViewWidth}px; height: ${canvasViewHeight}px;`
      );
      this.canvasDragElement?.nativeElement.appendChild(img);
      this.canvasDragElement?.nativeElement.setAttribute(
        'style',
        `position: absolute; display: block; visibility: visible; left: ${outputX}px; width: ${outputWidth}px; height: ${outputHeight}px;`
      );
      const videoContainer = this.magicCanvas.nativeElement.parentElement;
      if (videoContainer) {
        videoContainer.style.overflow = 'hidden';
      }
      this.displayObjectTracking = false;
      this.canvas?.clearRect(0, 0, this.videoWidth, this.videoHeight);
      this.previewVideoElem.nativeElement.controls = false;
      this.cropAreaRect = img.getBoundingClientRect();
    } else {
      const imgElement = this.canvasDragElement?.nativeElement
        .firstChild as HTMLImageElement;
      const newX =
        currentFrame.x +
        ((imgElement.getBoundingClientRect().x - this.cropAreaRect!.x) *
          this.videoWidth) /
        canvasViewWidth;
      this.updateVideoObjects(currentFrame.x, newX, idx);

      this.dragPosition = { x: 0, y: 0 };
      this.canvasDragElement?.nativeElement.setAttribute(
        'style',
        'display: none'
      );
      // Restore overflow to video container
      const videoContainer = this.magicCanvas.nativeElement.parentElement;
      if (videoContainer) {
        videoContainer.style.overflow = '';
      }
      this.magicCanvas.nativeElement.style.visibility = 'visible';
      this.previewVideoElem.nativeElement.controls = true;
      this.displayObjectTracking = true;
      this.drawFrame(this.activeVideoObjects);
    }
  }

  updateVideoObjects(currentX: number, newX: number, idx: number) {
    const cropArea = this.activeVideoObjects![0];
    const [startIdx, endIdx] = this.getMatchingCropAreaIndexRange(
      currentX,
      idx
    );
    for (let i = startIdx; i < endIdx; i++) {
      if (cropArea.frames[i].x === currentX) {
        cropArea.frames[i].x = newX;
      }
    }
  }

  getMatchingCropAreaIndexRange(currentX: number, idx: number) {
    const cropArea = this.activeVideoObjects![0];
    let startIdx = 0,
      endIdx = cropArea.frames.length;

    for (let i = idx; i < cropArea.frames.length; i++) {
      if (cropArea.frames[i].x !== currentX) {
        endIdx = i;
        break;
      }
    }
    for (let i = idx; i >= 0; i--) {
      if (cropArea.frames[i].x !== currentX) {
        startIdx = i + 1;
        break;
      }
    }
    return [startIdx, endIdx];
  }

  loadPreview() {
    this.previewTrackElem.nativeElement.src = this.subtitlesTrack;
    const value = this.previewToggleGroup.value;

    if (value === 'toggle') {
      this.displayObjectTracking = !this.displayObjectTracking;
      // Redraw frame to show/hide overlay immediately
      this.drawFrame(this.activeVideoObjects);
    } else if (value === 'settings') {
      this.openSmartFramingDialog();
    } else {
      // Handle aspect ratio selection
      let key = value;
      // Map legacy values to new keys if necessary
      if (value === 'square') key = '1:1';
      if (value === 'vertical') key = '9:16';

      if (this.useBlankingFill) {
        this.displayObjectTracking = false;
        this.activeVideoObjects = undefined;
        this.canvas?.clearRect(0, 0, this.videoWidth, this.videoHeight);
        this.drawFrame();
      } else if (this.previewAnalyses[key]) {
        this.displayObjectTracking = true;
        this.previewTrackElem.nativeElement.src = '';
        this.activeVideoObjects = this.previewAnalyses[key];
        this.drawFrame(this.activeVideoObjects);
      } else if (value === 'square' && this.squareVideoObjects) {
        this.displayObjectTracking = true;
        this.previewTrackElem.nativeElement.src = '';
        this.activeVideoObjects = this.squareVideoObjects;
        // Draw frame immediately to show overlay without needing to play video
        this.drawFrame(this.activeVideoObjects);
      } else if (value === 'vertical' && this.verticalVideoObjects) {
        this.displayObjectTracking = true;
        this.previewTrackElem.nativeElement.src = '';
        this.activeVideoObjects = this.verticalVideoObjects;
        // Draw frame immediately to show overlay without needing to play video
        this.drawFrame(this.activeVideoObjects);
      } else if (key === this.matchedAspectRatio) {
        // Original video aspect ratio - no cropping needed, just hide overlay
        this.displayObjectTracking = false;
        this.activeVideoObjects = undefined;
        this.canvas?.clearRect(0, 0, this.videoWidth, this.videoHeight);
      } else {
        // Format not supported with crop preview - hide overlay
        this.displayObjectTracking = false;
        this.activeVideoObjects = undefined;
        this.canvas?.clearRect(0, 0, this.videoWidth, this.videoHeight);
      }
    }
  }

  openSmartFramingDialog() {
    const { bottom, left } =
      this.previewToggleGroup._buttonToggles.last._buttonElement.nativeElement.getClientRects()[0];

    const dialogRef = this.dialog.open(SmartFramingDialog, {
      data: {
        weightsPersonFaceIndex: this.weightsPersonFaceIndex,
        weightsTextIndex: this.weightsTextIndex,
        weightSteps: this.weightSteps,
      },
      position: {
        top: `${bottom + 24}px`,
        left: `${left - 100}px`,
      },
      height: '300px',
    });

    dialogRef
      .afterClosed()
      .subscribe((result: FramingDialogData | undefined) => {
        if (
          result &&
          (this.weightsPersonFaceIndex !== result.weightsPersonFaceIndex ||
            this.weightsTextIndex !== result.weightsTextIndex)
        ) {
          this.weightsPersonFaceIndex = result.weightsPersonFaceIndex;
          this.weightsTextIndex = result.weightsTextIndex;
          this.generatePreviews(true);
        }
      });
  }

  skipSegment() {
    if (!this.avSegments || !this.variants || !this.previewVideoElem || !this.previewVideoElem.nativeElement) {
      return false;
    }
    const timestamp = this.previewVideoElem.nativeElement.currentTime;
    const currentSegment = this.avSegments.find(
      (segment: AvSegment) =>
        segment.start_s <= timestamp && segment.end_s >= timestamp
    );
    if (!currentSegment) {
      return false;
    }
    const allSelected = this.avSegments
      .filter((segment: AvSegment) => segment.selected)
      .map((segment: AvSegment) => segment.av_segment_id);
    const allPlayed = this.avSegments
      .filter((segment: AvSegment) => segment.played)
      .map((segment: AvSegment) => segment.av_segment_id);

    const lastSelectedSegmentToBePlayed = [...this.avSegments]
      .reverse()
      .find((segment: AvSegment) => segment.selected);
    const nextPlayableSegment = this.avSegments.find(
      (segment: AvSegment) => segment.selected && !segment.played
    );

    const currentSegmentPlaying =
      nextPlayableSegment &&
      nextPlayableSegment.av_segment_id === currentSegment.av_segment_id;
    const currentSegmentIsNotNext =
      currentSegment.selected &&
      !currentSegment.played &&
      nextPlayableSegment &&
      nextPlayableSegment.av_segment_id !== currentSegment.av_segment_id;
    const allSegmentsPlayed =
      JSON.stringify(allPlayed) === JSON.stringify(allSelected) &&
      lastSelectedSegmentToBePlayed !== undefined &&
      timestamp >= lastSelectedSegmentToBePlayed.end_s;
    const currentSegmentAlreadyPlayed =
      currentSegment.played &&
      allPlayed.indexOf(currentSegment.av_segment_id) !==
      allPlayed.length - 1 &&
      nextPlayableSegment &&
      nextPlayableSegment.av_segment_id !== currentSegment.av_segment_id;
    const skipSegment = !currentSegment.selected || currentSegmentAlreadyPlayed;

    if (currentSegmentPlaying) {
      currentSegment.played = true;
    } else if (
      currentSegmentIsNotNext ||
      currentSegmentAlreadyPlayed ||
      !currentSegment.selected
    ) {
      this.previewVideoElem.nativeElement.currentTime = nextPlayableSegment
        ? nextPlayableSegment.start_s
        : this.previewVideoElem.nativeElement.duration;
    } else if (allSegmentsPlayed) {
      this.previewVideoElem.nativeElement.currentTime =
        this.previewVideoElem.nativeElement.duration;
    }
    return skipSegment;
  }

  seekToSegment(av_segment_id: string) {
    const segment = this.avSegments?.find(
      (segment: AvSegment) => segment.av_segment_id === av_segment_id
    );
    if (segment) {
      this.previewVideoElem.nativeElement.currentTime = segment.start_s;
    }
  }

  setSelectedSegments(segments?: string[]) {
    if (!this.avSegments) {
      return;
    }
    for (const segment of this.avSegments) {
      segment.selected = false;
    }
    const segmentsToSelect =
      segments ?? this.variants?.[this.selectedVariant].scenes ?? [];
    for (const segmentId of segmentsToSelect) {
      const avSegment = this.avSegments.find(
        (segment: AvSegment) => segment.av_segment_id === String(segmentId)
      );
      if (avSegment) {
        avSegment.selected = true;
      }
    }
  }

  variantChanged() {
    if (!this.loadingVariant) {
      this.avSegments = structuredClone(this.originalAvSegments);
      this.setSelectedSegments();
      this.resetVariantPreview();
      this.allSegmentsToggle = false;
    }
  }

  resetVariantPreview() {
    const firstUnplayedSegment = this.avSegments?.find(
      (segment: AvSegment) => segment.selected && !segment.played
    );
    const firstSelectedSegment =
      this.avSegments && this.variants
        ? this.avSegments?.find(
          (segment: AvSegment) =>
            segment.av_segment_id ===
            this.variants![this.selectedVariant].scenes[0]
        )
        : null;
    this.previewVideoElem.nativeElement.currentTime = firstUnplayedSegment
      ? firstUnplayedSegment.start_s
      : firstSelectedSegment
        ? firstSelectedSegment.start_s
        : 0;
    this.setCurrentSegmentId();
    if (
      firstUnplayedSegment &&
      firstSelectedSegment &&
      firstUnplayedSegment.av_segment_id !== firstSelectedSegment.av_segment_id
    ) {
      this.previewVideoElem.nativeElement.play();
    } else if (!firstUnplayedSegment) {
      this.avSegments?.forEach((segment: AvSegment) => {
        segment.played = false;
      });
    }
  }

  addToRenderQueue() {
    const variant = this.variants![this.selectedVariant];
    const selectedSegments = this.avSegments!.filter(
      (segment: AvSegment) => segment.selected
    ).map((segment: AvSegment) => {
      return {
        av_segment_id: segment.av_segment_id,
        start_s: segment.start_s,
        end_s: segment.end_s,
        segment_screenshot_uri: segment.segment_screenshot_uri,
      };
    });

    // Validate that at least one segment is selected
    if (selectedSegments.length === 0) {
      this.snackBar.open('Please select at least one segment', 'Dismiss', {
        duration: 3000,
      });
      return;
    }

    const renderSettings = {
      generate_image_assets: this.demandGenAssets,
      generate_text_assets: this.demandGenAssets,
      formats: this.renderFormatsToggle.value as FormatType[],
      use_music_overlay: this.audioSettings === 'music',
      use_continuous_audio: this.audioSettings === 'continuous',
      fade_out: this.fadeOut,
      overlay_type: this.overlaySettings,
      use_blanking_fill: this.useBlankingFill,
    };
    const selectedScenes = selectedSegments.map(
      (segment: AvSegment) => segment.av_segment_id
    );
    const duration = TimeUtil.secondsToTimeString(
      selectedSegments.reduce(
        (total: number, segment: AvSegment) =>
          total + segment.end_s - segment.start_s,
        0
      )
    );
    const renderQueueVariant: RenderQueueVariant = {
      original_variant_id: this.selectedVariant,
      av_segments: selectedSegments,
      title: variant.title,
      description: variant.description,
      score: variant.score,
      abcd: variant.abcd,
      render_settings: renderSettings,
      duration: duration,
      scenes: selectedScenes.join(', '),
      userSelection:
        JSON.stringify(variant.scenes) !== JSON.stringify(selectedScenes),
    };
    const renderQueueVariantJson = JSON.stringify(renderQueueVariant);
    if (!this.renderQueueJsonArray.includes(renderQueueVariantJson)) {
      this.renderQueueJsonArray.push(renderQueueVariantJson);
      this.renderQueue.push(renderQueueVariant);
    }
    this.renderQueueSidenav.autoFocus = true;
    this.renderQueueSidenav.open();
    this.renderQueueSidenav.autoFocus = false;
  }

  toggleRenderQueueSidenav() {
    if (this.renderQueue.length) {
      this.renderQueueSidenav.toggle();
    }
  }

  removeRenderQueueVariant(event: Event, index: number) {
    this.renderQueueJsonArray.splice(index, 1);
    this.renderQueue.splice(index, 1);

    if (this.renderQueue.length === 0) {
      this.closeRenderQueueSidenav();
    }
    event.stopPropagation();
  }

  loadVariant(index: number) {
    const variant = this.renderQueue[index];
    this.loadingVariant = true;
    this.avSegments?.forEach((segment: AvSegment) => {
      segment.played = false;
    });
    this.selectedVariant = variant.original_variant_id;
    this.setSelectedSegments(
      variant.av_segments.map((segment: AvSegment) => segment.av_segment_id)
    );
    this.renderFormatsToggle.value = variant.render_settings.formats;
    this.demandGenAssets =
      variant.render_settings.generate_text_assets &&
      variant.render_settings.generate_image_assets;
    this.audioSettings = variant.render_settings.use_music_overlay
      ? 'music'
      : variant.render_settings.use_continuous_audio
        ? 'continuous'
        : 'segment';
    this.fadeOut = variant.render_settings.fade_out;
    this.useBlankingFill =
      (variant.render_settings as RenderSettings & { use_blanking_fill?: boolean })
        .use_blanking_fill ?? false;
    this.overlaySettings = variant.render_settings.overlay_type!;
    this.closeRenderQueueSidenav();
    setTimeout(() => {
      this.loadingVariant = false;
    }, 1000);
  }

  closeRenderQueueSidenav() {
    this.renderQueueSidenav.close();
    const trenderQueueButton = this.renderQueueButtonSpan.nativeElement
      .firstChild! as HTMLButtonElement;
    trenderQueueButton.blur();
  }

  renderVariants() {
    this.loading = true;
    this.rendering = true;
    this.apiCallsService
      .renderVariants(this.folder, {
        queue: this.renderQueue,
        queueName: this.renderQueueName,
        previewAnalyses: this.previewAnalyses,
        sourceDimensions: {
          w: this.previewVideoElem.nativeElement.videoWidth,
          h: this.previewVideoElem.nativeElement.videoHeight,
        },
      })
      .subscribe({
        next: combosFolder => {
          this.loading = false;
          this.renderQueue = [];
          this.renderQueueJsonArray = [];
          this.closeRenderQueueSidenav();
          this.getRenderedCombos(combosFolder);
        },
        error: err => this.failHandler(err),
      });
  }

  setCombos() {
    this.combos = Object.values(this.combosJson as Record<string, RawVariant>).map((combo: RawVariant) => {
      const segments = Object.values(combo.av_segments) as AvSegment[];
      const duration = TimeUtil.secondsToTimeString(
        segments.reduce(
          (total: number, segment: AvSegment) =>
            total + segment.end_s - segment.start_s,
          0
        )
      );
      const renderedVariant: RenderedVariant = {
        variant_id: combo.variant_id,
        av_segments: combo.av_segments,
        title: combo.title,
        description: combo.description,
        score: combo.score,
        abcd: combo.abcd,
        duration: duration,
        scenes: segments
          .map((segment: AvSegment) => segment.av_segment_id)
          .join(', '),
        render_settings: combo.render_settings,
      };
      renderedVariant.variants = {};
      for (const format in combo.variants) {
        if (Object.prototype.hasOwnProperty.call(combo.variants, format)) {
          renderedVariant.variants[format as FormatType] = {
            entity: combo.variants[format as FormatType],
            approved: true,
          };
        }
      }
      if (combo.images) {
        renderedVariant.images = {};
        for (const format in combo.images) {
          if (Object.prototype.hasOwnProperty.call(combo.images, format)) {
            const images = combo.images[format as FormatType].map((image: string) => {
              return { entity: image, approved: true };
            });
            renderedVariant.images[format as FormatType] = images;
          }
        }
      }
      if (combo.texts) {
        renderedVariant.texts = combo.texts.map((text: VariantTextAsset) => {
          text.editable = false;
          text.approved = true;
          return text;
        });
      }
      return renderedVariant;
    });
    this.originalCombos = structuredClone(this.combos);
  }

  restoreSegmentOrder() {
    if (
      !this.reorderSegmentsToggle?.checked &&
      JSON.stringify(this.avSegments) !==
      JSON.stringify(this.originalAvSegments)
    ) {
      this.avSegments = structuredClone(this.originalAvSegments);
      this.setSelectedSegments(this.variants![this.selectedVariant].scenes);
    }
  }

  storeCombosApproval(loading = true) {
    if (JSON.stringify(this.combos) !== JSON.stringify(this.originalCombos)) {
      this.loading = loading;
      this.apiCallsService
        .storeApprovalStatus(this.combosFolder, this.combos!)
        .subscribe((result: boolean) => {
          if (result) {
            this.originalCombos = structuredClone(this.combos);
          }
          this.loading = false;
          this.snackBar
            .open(
              result
                ? 'Saved successfully!'
                : 'An error occurred! Please try again.',
              'Dismiss',
              {
                horizontalPosition: 'center',
                duration: 2500,
              }
            )
            .onAction()
            .subscribe(() => {
              this.snackBar.dismiss();
            });
        });
    }
  }

  toggleAllSegments() {
    this.avSegments?.forEach((segment: AvSegment) => {
      segment.selected = this.allSegmentsToggle;
    });
  }

  calculateSelectedSegmentsDuration() {
    return (
      this.avSegments?.reduce(
        (sum: number, segment: AvSegment) =>
          segment.selected ? sum + (segment.end_s - segment.start_s) : sum,
        0
      ) ?? 0
    ).toFixed(2);
  }

  setEvalPrompt() {
    this.evalPrompt =
      CONFIG.vertexAi.abcdBusinessObjectives[this.selectedAbcdType].promptPart;
  }

  parseContentMarkdown() {
    this.evalPromptTextarea!.nativeElement.style.display = 'none';
    this.evalPromptPlaceholder!.nativeElement.innerHTML = marked.parse(
      this.evalPrompt
    ) as string;
    this.evalPromptPlaceholder!.nativeElement.style.display = 'block';
  }

  toggleContentDisplay() {
    this.evalPromptTextarea!.nativeElement.style.display = 'block';
    this.evalPromptPlaceholder!.nativeElement.style.display = 'none';
  }

  updateVideoPreview() {
    if (this.segmentModeToggle.value === 'segments') {
      this.previewVideoElem.nativeElement.pause();
    } else if (
      this.segmentModeToggle.value === 'preview' &&
      this.previewVideoElem.nativeElement.currentTime > 0
    ) {
      this.previewVideoElem.nativeElement.play();
    }
  }

  splitSegment(segmentMarkers: SegmentMarker[]) {
    this.loading = true;
    this.apiCallsService.splitSegment(this.folder, segmentMarkers).subscribe({
      next: result => {
        this.getAvSegments();
      },
      error: err => this.failHandler(err),
    });
  }
}
