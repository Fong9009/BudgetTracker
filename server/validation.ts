import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

// Generic validation middleware
export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// Query parameter validation middleware
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// Combined body and query validation middleware
export const validateRequestAndQuery = (bodySchema: ZodSchema, querySchema?: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validatedBody = bodySchema.parse(req.body);
      req.body = validatedBody;

      // Validate query parameters if schema provided
      if (querySchema) {
        const validatedQuery = querySchema.parse(req.query);
        req.query = validatedQuery as any;
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// Helper function to handle validation errors in try-catch blocks
export const handleValidationError = (error: unknown, res: Response) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }
  throw error; // Re-throw non-validation errors
}; 