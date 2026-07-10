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

import { COMPASS_INTELLIGENCE_PROMPTS, PROMPTS } from './prompts';
import { CONFIG } from './config';
import { AppLogger } from './logging';
import { StorageManager } from './storage';
import { TimeUtil } from './time-util';
import {
  GenerationSettings,
  VariantTextAsset,
} from './ui/src/app/api-calls/api-calls.service.interface';
import { VertexHelper } from './vertex';

const GENERATE_TEXT_ASSETS_REGEX =
  /.*Headline\s?:\**(?<headline>.*)\n+\**Description\s?:\**(?<description>.*)/ims;

export interface AvSegment {
  av_segment_id: string;
  description: string;
  visual_segment_ids: number[];
  audio_segment_ids: number[];
  start_s: number;
  end_s: number;
  duration_s: number;
  transcript: string[];
  labels: string[];
  objects: string[];
  text: string[];
  logos: string[];
  details: string[];
  keywords: string;
}

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
  abcd_dimensiones?: {
    attention_score: number;
    branding_score: number;
    connection_score: number;
    direction_score: number;
  };
  duration: string;
  strengths?: string[];
  weaknesses?: string[];
  insight_principal?: string;
}

export class GenerationHelper {
  static resolveGenerationPrompt(
    gcsFolder: string,
    settings: GenerationSettings
  ): string {
    const videoLanguage = GenerationHelper.getVideoLanguage(gcsFolder);
    const avSegments = GenerationHelper.getAvSegments(gcsFolder);

    // If not shortening, use full video duration
    const duration = settings.shortenVideo
      ? settings.duration
      : avSegments.reduce((total, seg) => total + seg.duration_s, 0);

    const expectedDurationRange =
      GenerationHelper.calculateExpectedDurationRange(duration);
    const videoScript = GenerationHelper.createVideoScript(
      gcsFolder,
      settings.shortenVideo ? settings.duration : Number.MAX_SAFE_INTEGER
    );

    // Use full video evaluation prompt if requested, else use aspect-ratio-only or regular generation prompt
    let promptTemplate = settings.shortenVideo
      ? CONFIG.vertexAi.generationPrompt
      : CONFIG.vertexAi.aspectRatioOnlyPrompt;

    if (settings.fullVideoAnalysis) {
      promptTemplate = CONFIG.vertexAi.fullVideoEvaluationPrompt;
    }

    // Build brand guidelines block from optional brandParams
    let brandSection = '';
    const bp = settings.brandParams;
    if (bp && (bp.brandName || bp.advertiserName || bp.country || bp.brandColor || bp.brandColor2 || bp.brandColor3 || bp.communicationTone)) {
      const lines: string[] = [
        '4b. **Brand & Client Guidelines (MANDATORY — apply to every combination):**',
      ];
      if (bp.brandName)
        lines.push(`    *   **Brand Name:** ${bp.brandName}`);
      if (bp.advertiserName)
        lines.push(`    *   **Advertiser:** ${bp.advertiserName}`);
      if (bp.country)
        lines.push(`    *   **Target Country/Market:** ${bp.country} — ensure cultural nuances and context align with this market.`);

      if (bp.brandColor || bp.brandColor2 || bp.brandColor3) {
        lines.push(`    *   **Brand Colors (hex):**`);
        if (bp.brandColor) lines.push(`        - Primary: ${bp.brandColor}`);
        if (bp.brandColor2) lines.push(`        - Secondary: ${bp.brandColor2}`);
        if (bp.brandColor3) lines.push(`        - Tertiary: ${bp.brandColor3}`);
        lines.push(`        Ensure visual elements, text overlays, and color grading referencing brand identity respect this color palette.`);
      }

      if (bp.communicationTone)
        lines.push(`    *   **Communication Tone:** ${bp.communicationTone} — all selected scenes and the overall narrative MUST reflect this tone.`);
      lines.push(
        '    *   Any combination that contradicts these brand guidelines must be discarded.'
      );
      brandSection = lines.join('\n');
    }

    const generationPrompt = promptTemplate
      .replace('{{{{userPrompt}}}}', settings.prompt)
      .replace('{{{{generationEvalPromptPart}}}}', settings.evalPrompt)
      .replace('{{{{brandGuidelines}}}}', brandSection)
      .replace('{{{{desiredDuration}}}}', String(duration))
      .replace('{{{{expectedDurationRange}}}}', expectedDurationRange)
      .replace('{{{{videoLanguage}}}}', videoLanguage)
      .replace('{{{{videoScript}}}}', videoScript);

    return generationPrompt;
  }

  static getVideoLanguage(gcsFolder: string): string {
    return (
      (StorageManager.loadFile(`${gcsFolder}/language.txt`, true) as string) ||
      CONFIG.defaultVideoLanguage
    );
  }

  static calculateExpectedDurationRange(duration: number): string {
    const durationFraction = 20 / 100;
    const expectedDurationRange = `${duration - duration * durationFraction}-${duration + duration * durationFraction}`;

    return expectedDurationRange;
  }

  static getAvSegments(gcsFolder: string): AvSegment[] {
    const key = `${gcsFolder}/data.json`;
    let avSegments = CacheService.getScriptCache().get(key);

    if (!avSegments) {
      avSegments = StorageManager.loadFile(key, true) as string;
      try {
        CacheService.getScriptCache().put(
          key,
          avSegments,
          CONFIG.defaultCacheExpiration
        );
      } catch (e) {
        AppLogger.warn(
          `WARNING - Failed to cache ${key} - check the associated file size as Apps Script caches content up to 100KB only.`
        );
      }
    }
    return JSON.parse(avSegments).map((avSegment: AvSegment) => {
      if (typeof avSegment.av_segment_id === 'number') {
        avSegment.av_segment_id = String(avSegment.av_segment_id + 1);
      }
      if (avSegment.av_segment_id.endsWith('.0')) {
        avSegment.av_segment_id = avSegment.av_segment_id.replace('.0', '');
      }
      return avSegment;
    }) as AvSegment[];
  }

  static createVideoScript(gcsFolder: string, duration: number): string {
    const avSegments = GenerationHelper.getAvSegments(gcsFolder);
    const videoScript: string[] = [];

    avSegments.forEach(avSegment => {
      if (avSegment.duration_s <= duration) {
        videoScript.push(`Scene ${avSegment.av_segment_id}`);
        videoScript.push(`${avSegment.start_s} --> ${avSegment.end_s}`);
        videoScript.push(
          `Duration: ${(avSegment.end_s - avSegment.start_s).toFixed(2)}s`
        );
        const description = avSegment.description;
        if (description) {
          videoScript.push(`Description: ${description.trim()}`);
        }
        videoScript.push(
          `Number of visual shots: ${avSegment.visual_segment_ids.length}`
        );
        const transcript = avSegment.transcript;
        const details = avSegment.labels.concat(avSegment.objects);
        const text = avSegment.text.map((t: string) => `"${t}"`);
        const logos = avSegment.logos;
        const keywords = avSegment.keywords;

        if (transcript) {
          videoScript.push(`Off-screen speech: "${transcript.join(' ')}"`);
        }
        if (details) {
          videoScript.push(`On-screen details: ${details.join(', ')}`);
        }
        if (text) {
          videoScript.push(`On-screen text: ${text.join(', ')}`);
        }
        if (logos) {
          videoScript.push(`Logos: ${logos.join(', ')}`);
        }
        if (keywords) {
          videoScript.push(`Keywords: ${keywords.trim()}`);
        }
        videoScript.push('');
      }
    });
    return videoScript.join('\n');
  }

  static promptLogger(gcsFolder: string, settings: GenerationSettings) {
    const prompt = GenerationHelper.resolveGenerationPrompt(
      gcsFolder,
      settings
    );
    return prompt;
  }

  static generateVariants(gcsFolder: string, settings: GenerationSettings) {
    const prompt = GenerationHelper.resolveGenerationPrompt(
      gcsFolder,
      settings
    );
    const variants: GenerateVariantsResponse[] = [];
    const avSegments = GenerationHelper.getAvSegments(gcsFolder);
    const avSegmentsMap = avSegments.reduce(
      (segments, segment) => ({
        ...segments,
        [segment.av_segment_id]: segment,
      }),
      {}
    );
    // Sort the scene IDs to ensure consistent comparison
    const allScenesArray = Object.keys(avSegmentsMap).sort((a, b) => Number(a) - Number(b));
    const allScenes = allScenesArray.join(', ');
    let iteration = 0;
    const maxIterations = 5;

    while (!variants.length && iteration < maxIterations) {
      iteration++;
      AppLogger.info(`GenerateVariants attempt #${iteration} of ${maxIterations}`);
      AppLogger.info(`Mode: ${settings.shortenVideo ? 'SHORTENING' : 'ASPECT RATIO ONLY'}`);
      const response = VertexHelper.generate(prompt);
      AppLogger.info(`GenerateVariants Response #${iteration}: ${response}`);

      const jsonMatch = response.match(/\[[\s\S]*\]/s);

      if (jsonMatch) {
        try {
          const parsedResults = JSON.parse(jsonMatch[0]);
          AppLogger.info(`Parsed response into ${parsedResults.length} results (JSON)`);

          parsedResults.forEach((result: any, index: number) => {
            AppLogger.info(`\n=== Processing result #${index + 1} ===`);
            const { title, scenes, description, score, duration, abcd } = result;

            const trimmedScenes = String(scenes)
              .trim()
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
              .map(scene =>
                scene.toLowerCase().replace('scene ', '').replace('.0', '')
              );

            if (trimmedScenes.length === 0) {
              AppLogger.warn(`✗ Rejected: Variant has no scenes.\nResult: ${JSON.stringify(result)}`);
              return;
            }

            const sortedTrimmedScenes = trimmedScenes.sort((a, b) => Number(a) - Number(b));
            const trimmedScenesStr = sortedTrimmedScenes.join(', ');

            AppLogger.info(`Scenes found: "${trimmedScenesStr}"`);
            AppLogger.info(`All scenes: "${allScenes}"`);

            const shouldAcceptVariant = settings.shortenVideo && !settings.fullVideoAnalysis
              ? trimmedScenesStr !== allScenes
              : true;

            if (shouldAcceptVariant) {
              const outputScenes = sortedTrimmedScenes;
              const filteredSegments = avSegments.filter((segment: AvSegment) =>
                outputScenes.includes(segment.av_segment_id)
              );

              if (filteredSegments.length === 0) {
                AppLogger.warn(
                  `✗ Rejected: Variant has no matching segments. Scenes: ${JSON.stringify(outputScenes)}`
                );
                return;
              }

              const variant: GenerateVariantsResponse = {
                combo_id: index + 1,
                title: String(title).trim(),
                scenes: outputScenes,
                av_segments: filteredSegments,
                description: String(description || '').trim(),
                score: Number(String(score).replace(/[^\d.]/g, '').trim()),
                abcd: {
                  attention: String(abcd?.attention || '').trim(),
                  branding: String(abcd?.branding || '').trim(),
                  connection: String(abcd?.connection || '').trim(),
                  direction: String(abcd?.direction || '').trim()
                },
                abcd_dimensiones: result.abcd_dimensiones ? {
                  attention_score: Number(result.abcd_dimensiones.attention_score) || 0,
                  branding_score: Number(result.abcd_dimensiones.branding_score) || 0,
                  connection_score: Number(result.abcd_dimensiones.connection_score) || 0,
                  direction_score: Number(result.abcd_dimensiones.direction_score) || 0
                } : undefined,
                duration: GenerationHelper.calculateVariantDuration(
                  outputScenes,
                  avSegmentsMap
                ),
                strengths: result.strengths || [],
                weaknesses: result.weaknesses || [],
                insight_principal: result.insight_principal || result.description || ''
              };
              variants.push(variant);
              AppLogger.info(`✓ Variant #${variants.length} added: "${variant.title}"`);
            } else {
              AppLogger.warn(
                `✗ Rejected: Response with ALL scenes in shortening mode.\nScenes: ${trimmedScenesStr}`
              );
            }
          });
        } catch (e: any) {
          AppLogger.error(`✗ JSON PARSE FAILED: ${e.message}`);
          console.error(`✗ JSON PARSE FAILED: ${e.message}`);
          AppLogger.error('\nActual response received:');
          AppLogger.error(response);
        }
      } else {
        AppLogger.error(`✗ NO JSON ARRAY FOUND IN RESPONSE`);
        console.error(`✗ NO JSON ARRAY FOUND IN RESPONSE`);
        AppLogger.error('\nActual response received:');
        AppLogger.error(response);
      }
    }

    AppLogger.info(`\n=== Generation Summary ===`);
    AppLogger.info(`Total variants generated: ${variants.length}`);
    AppLogger.info(`Iterations used: ${iteration}/${maxIterations}`);

    if (!variants.length) {
      const errorMsg = `Failed to generate valid variants after ${maxIterations} attempts. Please check the logs for details.`;
      AppLogger.error(errorMsg);
      throw new Error(errorMsg);
    }

    return variants.sort(
      (a, b) =>
        Math.abs(settings.duration - TimeUtil.timeStringToSeconds(a.duration)) -
        Math.abs(
          settings.duration - TimeUtil.timeStringToSeconds(b.duration)
        ) || b.score - a.score
    );
  }

  static calculateVariantDuration(
    scenes: string[],
    avSegmentsMap: Record<string, AvSegment>
  ): string {
    let duration = 0;

    for (const scene of scenes) {
      const avSegment = avSegmentsMap[scene];
      if (avSegment) {
        duration += avSegment.end_s - avSegment.start_s;
      }
    }
    return TimeUtil.secondsToTimeString(duration);
  }

  static generateTextAsset(
    variantVideoPath: string,
    textAsset: VariantTextAsset,
    textAssetLanguage: string
  ): VariantTextAsset {
    const generationPrompt = CONFIG.vertexAi.textAssetsGenerationPrompt
      .replace('{{videoLanguage}}', textAssetLanguage)
      .replace('{{desiredCount}}', '1')
      .replace('3. ', '4. ')
      .replace(
        '{{badExamplePromptPart}}',
        CONFIG.vertexAi.textAssetsBadExamplePromptPart
      )
      .replace('{{headline}}', textAsset.headline)
      .replace('{{description}}', textAsset.description);

    const response = VertexHelper.generate(
      generationPrompt,
      `gs:/${decodeURIComponent(variantVideoPath)}`
    );
    AppLogger.info(`GenerateTextAsset Response: ${response}`);
    const result = response.split('## Ad').filter(Boolean)[0];
    const matches = result.match(GENERATE_TEXT_ASSETS_REGEX);
    if (matches) {
      const { headline, description } = matches.groups as {
        headline: string;
        description: string;
      };
      return {
        headline: String(headline).trim(),
        description: String(description).trim(),
      };
    } else {
      const message = `WARNING - Received an incomplete response from the API!\nResponse: ${response}`;
      AppLogger.warn(message);
      throw new Error(message);
    }
  }

  static generateTextAssets(
    variantVideoPath: string,
    textAssetsLanguage: string
  ) {
    const count = 5;
    const generationPrompt = CONFIG.vertexAi.textAssetsGenerationPrompt
      .replace('{{videoLanguage}}', textAssetsLanguage)
      .replace('{{desiredCount}}', String(count))
      .replace('{{badExamplePromptPart}}\n    ', '');

    const textAssets: VariantTextAsset[] = [];
    let iteration = 0;

    while (textAssets.length < count) {
      iteration++;
      const response = VertexHelper.generate(
        generationPrompt,
        `gs:/${decodeURIComponent(variantVideoPath)}`
      );
      AppLogger.info(`GenerateTextAssets Response: ${response}`);

      const results = response.split('## Ad').filter(Boolean);

      for (const result of results) {
        const matches = result.match(GENERATE_TEXT_ASSETS_REGEX);
        if (matches) {
          const { headline, description } = matches.groups as {
            headline: string;
            description: string;
          };
          textAssets.push({
            headline: String(headline).trim(),
            description: String(description).trim(),
          });
          if (textAssets.length === count) {
            break;
          }
        } else {
          AppLogger.warn(
            `WARNING - Received an incomplete response for iteration #${iteration} from the API!\nResponse: ${response}`
          );
        }
      }
    }
    return textAssets;
  }

  static generateYoutubeIdeas(
    gcsFolder: string,
    abcdType: string,
    customPoints: string,
    mode: string,
    selectedValue: string,
    selectedCategories?: string[],
    macroJson?: string,
    microJson?: string
  ): string {
    const dataFile = StorageManager.loadFile(
      `${gcsFolder}/${CONFIG.cloudStorage.files.data}`,
      true
    ) as string;
    const analysisFile = StorageManager.loadFile(
      `${gcsFolder}/${CONFIG.cloudStorage.files.analysis}`,
      true
    ) as string;

    const brandParamsFile = StorageManager.loadFile(
      `${gcsFolder}/brand_parameters.json`,
      true
    ) as string;

    if (!dataFile || !analysisFile) {
      throw new Error('Analysis or data files not found.');
    }


    const avSegments = JSON.parse(dataFile);
    const videoAnalysis = JSON.parse(analysisFile);

    // Extract segments to pass to the AI
    let segmentsText = 'No specific segments available.';
    if (Array.isArray(avSegments)) {
      segmentsText = avSegments
        .map((seg: any, index: number) => {
          const start = TimeUtil.secondsToTimeString(seg.start_s);
          const end = TimeUtil.secondsToTimeString(seg.end_s);
          const description = seg.description || 'Visual sequence';
          const transcript = seg.transcript && seg.transcript.length > 0 ? ` [Transcript: ${seg.transcript.join(' ')}]` : '';
          return `* Segment ${index} (${start} - ${end}): ${description}${transcript}`;
        })
        .join('\n');
    }

    // Build personalization context based on mode
    let personalizationContext = 'Generate comprehensive YouTube content ideation covering both category-specific and geographic personalization strategies.';
    if (mode === 'category' && selectedValue) {
      personalizationContext = `The content MUST be specifically optimized for the YouTube category/categories: **${selectedValue}**. Tailor the production script, tone, pacing, storytelling format, and creative angles to resonate deeply with the typical audience of this category. Every insight and recommendation should speak directly to what works best`;
    } else if (mode === 'geokey') {
      personalizationContext = `INSTRUCCIONES PARA MODO GEOKEY:
El usuario ha analizado su mercado usando inteligencia geoespacial y ha detectado zonas de alta oportunidad.
A continuación se provee la Estrategia Macro (Municipios Top) y las Oportunidades Micro (Hexágonos de alta relevancia):

ESTRATEGIA MACRO (Top Municipios):
${macroJson || 'No provisto'}

OPORTUNIDADES MICRO (Hexágonos Top 20 con audiencia):
${microJson || 'No provisto'}

TU TAREA:
1. Analiza los Municipios y los Hexágonos (Micro) provistos.
2. Identifica puntos de interés, centros comerciales, parques, o hitos culturales relevantes en estos estados/municipios.
3. Define el perfil de la audiencia basándote en la población y métricas de esas zonas específicas.
4. Genera ideas creativas de video CTV hiper-localizadas, que hagan referencia explícita al contexto local de estas ubicaciones (ej. menciona un barrio, un centro comercial, o un acento/cultura local).
5. Integra los segmentos del video y el análisis ABCD para hacer las ideas relevantes.
6. Responde usando el campo "geoKeyInsights" del JSON de salida. Deja "categoryIdeas" nulo.`;
    }

    // Safe extraction of promptPart from config
    const abcdBusinessObjectives = CONFIG.vertexAi.abcdBusinessObjectives as Record<string, { promptPart: string }>;
    const abcdPrompt = abcdBusinessObjectives[abcdType]?.promptPart || '';

    let prompt = CONFIG.vertexAi.youtubeIdeasPrompt;
    // We only pass a summarized version of the analysis to avoid token overflow
    const conciseAnalysis = {
      labels: videoAnalysis.labels || [],
      objects: videoAnalysis.objects || [],
      text: videoAnalysis.text || []
    };
    // Build Brand Guidelines Context
    let brandSection = 'No specific brand guidelines provided.';
    if (brandParamsFile) {
      try {
        const bp = JSON.parse(brandParamsFile);
        if (bp.brandName || bp.advertiserName || bp.country || bp.brandColor || bp.communicationTone) {
          const lines: string[] = ['**Brand & Client Guidelines (MANDATORY):**'];
          if (bp.brandName) lines.push(`*   **Brand Name:** ${bp.brandName}`);
          if (bp.advertiserName) lines.push(`*   **Advertiser:** ${bp.advertiserName}`);
          if (bp.country) lines.push(`*   **Target Market:** ${bp.country}`);
          if (bp.brandColor || bp.brandColor2 || bp.brandColor3) {
            lines.push(`*   **Brand Colors:** Primary: ${bp.brandColor || 'N/A'}, Secondary: ${bp.brandColor2 || 'N/A'}, Tertiary: ${bp.brandColor3 || 'N/A'}`);
          }
          if (bp.communicationTone) lines.push(`*   **Communication Tone:** ${bp.communicationTone}`);
          lines.push('*   The generated content and all creative insights MUST strictly adhere to these brand parameters.');
          brandSection = lines.join('\n');
        }
      } catch (e) {
        AppLogger.warn('Failed to parse brand parameters in youtube ideas generation.');
      }
    }

    prompt = prompt.replace('{{personalizationContext}}', personalizationContext);
    prompt = prompt.replace('{{analysis}}', JSON.stringify(conciseAnalysis));
    prompt = prompt.replace('{{segments}}', segmentsText);
    prompt = prompt.replace('{{abcd}}', abcdPrompt);
    prompt = prompt.replace('{{brandGuidelines}}', brandSection);
    prompt = prompt.replace('{{customPoints}}', customPoints);

    AppLogger.info(`GenerateYoutubeIdeas Prompt: ${prompt}`);
    let response = VertexHelper.generate(prompt);

    // Clean potential markdown from Gemini response
    response = response.trim();
    if (response.startsWith('```json')) {
      response = response.substring(7);
    } else if (response.startsWith('```')) {
      response = response.substring(3);
    }
    if (response.endsWith('```')) {
      response = response.substring(0, response.length - 3);
    }
    response = response.trim();

    AppLogger.info(`GenerateYoutubeIdeas Response: ${response}`);

    return response;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPASS PIPELINE — Pasos 4, 5 y 6 del flujo orquestado
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Paso 4: Geo Intelligence
   * Analiza los datos geográficos del CSV junto con el contexto de la campaña
   * para generar macro estrategias y micro oportunidades territoriales.
   */
  static generateGeoIntelligence(
    compassContextJson: string,
    macroJson: string,
    microJson: string
  ): string {
    // Truncar el macroJson para evitar exceder el contexto del modelo.
    // El Top 100 zonas es demasiado grande; limitamos a Top 30 para el análisis geo.
    let macroJsonTruncated = macroJson;
    try {
      const macroParsed = JSON.parse(macroJson);
      if (macroParsed && macroParsed.top_zonas_demanda && Array.isArray(macroParsed.top_zonas_demanda)) {
        macroParsed.top_zonas_demanda = macroParsed.top_zonas_demanda.slice(0, 30);
        macroJsonTruncated = JSON.stringify(macroParsed);
        AppLogger.info(`Compass: GeoIntelligence macroJson truncado a ${macroParsed.top_zonas_demanda.length} zonas`);
      }
    } catch (e) {
      AppLogger.warn(`Compass: GeoIntelligence - no se pudo parsear macroJson para truncar, usando original`);
    }

    // Truncar microJson a top 10 clusters
    let microJsonTruncated = microJson;
    try {
      const microParsed = JSON.parse(microJson);
      if (microParsed && microParsed.top_clusters && Array.isArray(microParsed.top_clusters)) {
        microParsed.top_clusters = microParsed.top_clusters.slice(0, 10);
        microJsonTruncated = JSON.stringify(microParsed);
        AppLogger.info(`Compass: GeoIntelligence microJson truncado a ${microParsed.top_clusters.length} clusters`);
      }
    } catch (e) {
      AppLogger.warn(`Compass: GeoIntelligence - no se pudo parsear microJson para truncar, usando original`);
    }

    let prompt = COMPASS_INTELLIGENCE_PROMPTS.geoIntelligence;
    prompt = prompt.replace('{{compassContextJson}}', compassContextJson);
    prompt = prompt.replace('{{macroJson}}', macroJsonTruncated);
    prompt = prompt.replace('{{microJson}}', microJsonTruncated);

    AppLogger.info('Compass: generateGeoIntelligence starting');
    AppLogger.info(`Compass: GeoIntelligence prompt length: ${prompt.length} chars`);
    let response = VertexHelper.generate(prompt);
    response = response.trim();
    if (response.startsWith('```json')) response = response.substring(7);
    else if (response.startsWith('```')) response = response.substring(3);
    if (response.endsWith('```')) response = response.substring(0, response.length - 3);
    response = response.trim();
    AppLogger.info(`Compass: GeoIntelligence Response (primeros 500 chars): ${response.substring(0, 500)}`);
    AppLogger.info(`Compass: GeoIntelligence Response length: ${response.length}`);
    return response;
  }

  /**
   * Paso 5: Channel & Category Intelligence
   * Con el contexto acumulado, responde: ¿En qué contextos funciona mejor el contenido?
   */
  static generateChannelIntelligence(
    compassContextJson: string,
    categories: string[]
  ): string {
    const categoriesText = categories.join(', ');
    let prompt = COMPASS_INTELLIGENCE_PROMPTS.channelIntelligence;
    prompt = prompt.replace('{{compassContextJson}}', compassContextJson);
    prompt = prompt.replace('{{categoriesText}}', categoriesText);

    AppLogger.info('Compass: generateChannelIntelligence starting');
    let response = VertexHelper.generate(prompt);
    response = response.trim();
    if (response.startsWith('```json')) response = response.substring(7);
    else if (response.startsWith('```')) response = response.substring(3);
    if (response.endsWith('```')) response = response.substring(0, response.length - 3);
    response = response.trim();
    AppLogger.info(`Compass: ChannelIntelligence Response: ${response}`);
    return response;
  }

  /**
   * Paso 6: Priorización de Insights
   * Con TODO el contexto acumulado, responde: ¿Qué debería hacer ahora?
   */
  static generatePrioritization(compassContextJson: string): string {
    let prompt = COMPASS_INTELLIGENCE_PROMPTS.prioritization;
    prompt = prompt.replace('{{compassContextJson}}', compassContextJson);

    AppLogger.info('Compass: generatePrioritization starting');
    let response = VertexHelper.generate(prompt);
    response = response.trim();
    if (response.startsWith('```json')) response = response.substring(7);
    else if (response.startsWith('```')) response = response.substring(3);
    if (response.endsWith('```')) response = response.substring(0, response.length - 3);
    response = response.trim();
    AppLogger.info(`Compass: Prioritization Response: ${response}`);
    return response;
  }
}
