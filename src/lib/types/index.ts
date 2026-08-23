/**
 * SOURCE OF TRUTH KEYWORDS: AUTH_PASSWORD_MIN_LENGTH, signInSchema,
 *   signUpSchema, SignInValues, SignUpValues, AuthFormMode, AuthValuesByMode,
 *   authSchemaFor, createOrganizationSchema, CreateOrganizationValues,
 *   inviteMemberSchema, updateMemberSchema, removeMemberSchema,
 *   cancelInvitationSchema, resendInvitationSchema, createRoleSchema,
 *   updateRoleSchema, deleteRoleSchema, roleNameSchema, permissionStringSchema,
 *   createSubscriptionSchema, upgradeSubscriptionSchema, billingIntervalSchema,
 *   planKeySchema, CreateSubscriptionValues, UpgradeSubscriptionValues,
 *   createDiagramSchema, saveCanvasSchema, createEntitySchema,
 *   createFieldSchema, cardinalitySchema, createRelationSchema,
 *   generateExportSchema, snapshotPayloadSchema, DiagramWithGraphRow,
 *   aiDesignSchema, generateAiSchemaSchema, aiSchemaPromptSchema,
 *   AiDesignValues, GenerateAiSchemaValues, CodegenGraph, GeneratedFile
 *
 * WHAT:  Barrel re-export for `src/lib/types/*` — the single import surface
 *        for custom (non-Prisma) types and their backing zod schemas.
 * WHY:   Per CLAUDE.md, custom types live under `lib/types` exclusively.
 *        Routing every consumer through `@/lib/types` keeps that constraint
 *        easy to enforce: imports from anywhere else are a code-smell flag.
 * WHERE: Imported by client + server code that needs auth (or future)
 *        input contracts.
 */

export {
  AUTH_PASSWORD_MIN_LENGTH,
  signInSchema,
  signUpSchema,
  authSchemaFor,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth'
export type {
  SignInValues,
  SignUpValues,
  AuthFormMode,
  AuthValuesByMode,
  ForgotPasswordValues,
  ResetPasswordValues,
} from './auth'
export { createOrganizationSchema, updateOrganizationSettingsSchema } from './organization'
export type {
  CreateOrganizationValues,
  UpdateOrganizationSettingsValues,
} from './organization'
export {
  inviteMemberSchema,
  updateMemberSchema,
  removeMemberSchema,
  cancelInvitationSchema,
  resendInvitationSchema,
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
  roleNameSchema,
  permissionStringSchema,
  RESERVED_ROLE_NAMES,
  VALID_PERMISSION_STRINGS,
} from './team'
export type {
  InviteMemberValues,
  UpdateMemberValues,
  CreateRoleValues,
  UpdateRoleValues,
} from './team'
export {
  billingIntervalSchema,
  planKeySchema,
  createSubscriptionSchema,
  upgradeSubscriptionSchema,
  paymentMethodIdSchema,
} from './billing'
export type {
  CreateSubscriptionValues,
  UpgradeSubscriptionValues,
} from './billing'
export {
  diagramNameSchema,
  entityNameSchema,
  fieldNameSchema,
  cardinalitySchema,
  onDeleteSchema,
  exportDialectSchema,
  dataTypeSchema,
  entityColorKeySchema,
  createDiagramSchema,
  updateDiagramSchema,
  duplicateDiagramSchema,
  listDiagramsSchema,
  getDiagramSchema,
  deleteDiagramSchema,
  saveCanvasSchema,
  createEntitySchema,
  updateEntitySchema,
  deleteEntitySchema,
  createFieldSchema,
  updateFieldSchema,
  deleteFieldSchema,
  reorderFieldsSchema,
  createRelationSchema,
  updateRelationSchema,
  deleteRelationSchema,
  generateExportSchema,
  snapshotLabelSchema,
  snapshotPayloadSchema,
  createSnapshotSchema,
  restoreSnapshotSchema,
  listSnapshotsSchema,
  isCardinalityValue,
  isOnDeleteValue,
} from './diagram'
export type {
  CreateDiagramValues,
  UpdateDiagramValues,
  DuplicateDiagramValues,
  ListDiagramsValues,
  GetDiagramValues,
  DeleteDiagramValues,
  SaveCanvasValues,
  CanvasEntityPatch,
  CreateEntityValues,
  UpdateEntityValues,
  DeleteEntityValues,
  CreateFieldValues,
  UpdateFieldValues,
  DeleteFieldValues,
  ReorderFieldsValues,
  CreateRelationValues,
  UpdateRelationValues,
  DeleteRelationValues,
  GenerateExportValues,
  SnapshotPayloadValues,
  CreateSnapshotValues,
  RestoreSnapshotValues,
  CardinalityValue,
  OnDeleteValue,
  ExportDialect,
  DiagramRow,
  DiagramWithGraphRow,
  DiagramListItemRow,
  GraphFieldValues,
  EntityNodeData,
  RelationEdgeData,
  EntityFlowNode,
  RelationFlowEdge,
} from './diagram'

export {
  aiDesignSchema,
  aiDesignEntitySchema,
  aiDesignFieldSchema,
  aiDesignRelationSchema,
  aiSchemaModeSchema,
  aiSchemaPromptSchema,
  aiSchemaFormSchema,
  generateAiSchemaSchema,
  AI_DESIGN_MAX_ENTITIES,
  AI_DESIGN_MAX_FIELDS,
} from './ai-schema'
export type {
  AiDesignValues,
  AiDesignEntityValues,
  AiDesignFieldValues,
  AiDesignRelationValues,
  GenerateAiSchemaValues,
  AiSchemaMode,
  AiSchemaFormValues,
} from './ai-schema'

export type {
  CodegenGraph,
  CodegenEntity,
  CodegenField,
  CodegenRelation,
  CodegenLanguage,
  CodegenTargetKey,
  GeneratedFile,
} from './codegen'
