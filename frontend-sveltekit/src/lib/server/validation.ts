/**
 * Input validation utilities for security
 */

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validates email format
 */
export function validateEmail(email: string | null | undefined): ValidationResult {
	if (!email || typeof email !== 'string') {
		return { valid: false, error: 'Email is required' };
	}

	const trimmed = email.trim();

	if (trimmed.length === 0) {
		return { valid: false, error: 'Email cannot be empty' };
	}

	if (trimmed.length > 254) {
		return { valid: false, error: 'Email is too long' };
	}

	// RFC 5322 simplified regex
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(trimmed)) {
		return { valid: false, error: 'Invalid email format' };
	}

	// Prevent SQL injection attempts
	if (trimmed.includes('--') || trimmed.includes(';') || trimmed.includes("'")) {
		return { valid: false, error: 'Email contains invalid characters' };
	}

	return { valid: true };
}

/**
 * Validates password strength
 */
export function validatePassword(password: string | null | undefined): ValidationResult {
	if (!password || typeof password !== 'string') {
		return { valid: false, error: 'Password is required' };
	}

	if (password.length < 12) {
		return { valid: false, error: 'Password must be at least 12 characters long' };
	}

	if (password.length > 128) {
		return { valid: false, error: 'Password is too long (max 128 characters)' };
	}

	// Check complexity: at least one lowercase, one uppercase, one digit, one special char
	const hasLowercase = /[a-z]/.test(password);
	const hasUppercase = /[A-Z]/.test(password);
	const hasDigit = /[0-9]/.test(password);
	const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

	const complexityCount = [hasLowercase, hasUppercase, hasDigit, hasSpecial].filter(Boolean).length;

	if (complexityCount < 3) {
		return {
			valid: false,
			error: 'Password must contain at least 3 of: lowercase, uppercase, digit, special character'
		};
	}

	return { valid: true };
}

/**
 * Validates and sanitizes integer ID
 */
export function validateId(id: string | null | undefined): ValidationResult {
	if (!id || typeof id !== 'string') {
		return { valid: false, error: 'ID is required' };
	}

	const trimmed = id.trim();

	// Must be a positive integer
	const numericRegex = /^\d+$/;
	if (!numericRegex.test(trimmed)) {
		return { valid: false, error: 'ID must be a positive integer' };
	}

	const parsed = parseInt(trimmed, 10);

	if (isNaN(parsed) || parsed <= 0 || parsed > 2147483647) {
		return { valid: false, error: 'Invalid ID value' };
	}

	return { valid: true };
}

/**
 * Validates name (for users and admins)
 */
export function validateName(name: string | null | undefined): ValidationResult {
	if (!name || typeof name !== 'string') {
		return { valid: false, error: 'Name is required' };
	}

	const trimmed = name.trim();

	if (trimmed.length === 0) {
		return { valid: false, error: 'Name cannot be empty' };
	}

	if (trimmed.length < 2) {
		return { valid: false, error: 'Name must be at least 2 characters' };
	}

	if (trimmed.length > 100) {
		return { valid: false, error: 'Name is too long (max 100 characters)' };
	}

	// Prevent SQL injection and XSS attempts
	if (trimmed.includes('<') || trimmed.includes('>') || trimmed.includes('--') || trimmed.includes(';')) {
		return { valid: false, error: 'Name contains invalid characters' };
	}

	return { valid: true };
}

/**
 * Validates role
 */
export function validateRole(role: string | null | undefined): ValidationResult {
	if (!role || typeof role !== 'string') {
		return { valid: false, error: 'Role is required' };
	}

	const validRoles = ['super-admin', 'editor', 'viewer'];
	if (!validRoles.includes(role)) {
		return { valid: false, error: 'Invalid role. Must be: super-admin, editor, or viewer' };
	}

	return { valid: true };
}

/**
 * Validates post title
 */
export function validateTitle(title: string | null | undefined): ValidationResult {
	if (!title || typeof title !== 'string') {
		return { valid: false, error: 'Title is required' };
	}

	const trimmed = title.trim();

	if (trimmed.length === 0) {
		return { valid: false, error: 'Title cannot be empty' };
	}

	if (trimmed.length < 3) {
		return { valid: false, error: 'Title must be at least 3 characters' };
	}

	if (trimmed.length > 200) {
		return { valid: false, error: 'Title is too long (max 200 characters)' };
	}

	return { valid: true };
}

/**
 * Validates post content
 */
export function validateContent(content: string | null | undefined): ValidationResult {
	if (!content || typeof content !== 'string') {
		return { valid: false, error: 'Content is required' };
	}

	const trimmed = content.trim();

	if (trimmed.length === 0) {
		return { valid: false, error: 'Content cannot be empty' };
	}

	if (trimmed.length > 50000) {
		return { valid: false, error: 'Content is too long (max 50,000 characters)' };
	}

	return { valid: true };
}

/**
 * Helper function to collect all validation errors
 */
export function collectValidationErrors(results: ValidationResult[]): string[] {
	return results.filter((r) => !r.valid).map((r) => r.error!);
}
