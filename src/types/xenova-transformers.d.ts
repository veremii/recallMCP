/**
 * Type declarations for @xenova/transformers
 */

declare module '@xenova/transformers' {
  export interface PipelineOptions {
    quantized?: boolean;
  }

  export interface FeatureExtractionOptions {
    pooling?: 'mean' | 'cls' | 'none';
    normalize?: boolean;
  }

  export interface Tensor {
    data: Float32Array | Int32Array;
    dims: number[];
  }

  export type FeatureExtractionPipeline = (
    text: string | string[],
    options?: FeatureExtractionOptions
  ) => Promise<Tensor>;

  export function pipeline(
    task: 'feature-extraction',
    model: string,
    options?: PipelineOptions
  ): Promise<FeatureExtractionPipeline>;

  export function pipeline(
    task: string,
    model: string,
    options?: PipelineOptions
  ): Promise<unknown>;
}
