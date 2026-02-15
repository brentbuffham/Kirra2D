// src/shaders/index.js
// Public API exports for the Kirra shader system

// Core infrastructure
export { ColourRampFactory } from "./core/ColourRampFactory.js";
export { ShaderUniformManager } from "./core/ShaderUniformManager.js";
export { ShaderFlattenHelper } from "./core/ShaderFlattenHelper.js";
export { BaseAnalyticsShader } from "./core/BaseAnalyticsShader.js";

// Analytics models
export { PPVModel } from "./analytics/models/PPVModel.js";
export { HeelanOriginalModel } from "./analytics/models/HeelanOriginalModel.js";
export { ScaledHeelanModel } from "./analytics/models/ScaledHeelanModel.js";
export { NonLinearDamageModel } from "./analytics/models/NonLinearDamageModel.js";

// Main analytics orchestrator
export { BlastAnalyticsShader } from "./analytics/BlastAnalyticsShader.js";

// Surface comparison shader
export { SurfaceCompareShader } from "./surface/SurfaceCompareShader.js";
