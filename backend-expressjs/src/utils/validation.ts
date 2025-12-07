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

/**
 * Validates purchase amount for cashier transactions
 */
export function validatePurchaseAmount(amount: number | null | undefined): ValidationResult {
	if (amount === null || amount === undefined) {
		return { valid: false, error: 'Сумма покупки обязательна' };
	}

	if (typeof amount !== 'number' || isNaN(amount)) {
		return { valid: false, error: 'Сумма покупки должна быть числом' };
	}

	if (amount <= 0) {
		return { valid: false, error: 'Сумма покупки должна быть больше 0' };
	}

	if (amount > 1000000) {
		return { valid: false, error: 'Сумма покупки не может превышать 1,000,000 ₽' };
	}

	return { valid: true };
}

/**
 * Validates points to redeem
 * @param maxDiscountPercent - Maximum discount percentage from loyalty settings (e.g., 20 for 20%)
 */
export function validatePointsToRedeem(
	points: number | null | undefined,
	customerBalance: number,
	purchaseAmount: number,
	maxDiscountPercent: number
): ValidationResult {
	if (points === null || points === undefined) {
		return { valid: false, error: 'Количество баллов обязательно' };
	}

	if (typeof points !== 'number' || isNaN(points)) {
		return { valid: false, error: 'Количество баллов должно быть числом' };
	}

	if (points <= 0) {
		return { valid: false, error: 'Количество баллов должно быть больше 0' };
	}

	if (points > customerBalance) {
		return { valid: false, error: `Недостаточно баллов. Доступно: ${customerBalance}` };
	}

	// Check max discount limit from settings (1 point = 1 ruble)
	const maxDiscount = purchaseAmount * (maxDiscountPercent / 100);
	if (points > maxDiscount) {
		return {
			valid: false,
			error: `Скидка не может превышать ${maxDiscountPercent}% от покупки. Максимум: ${Math.floor(maxDiscount)} баллов`
		};
	}

	return { valid: true };
}

/**
 * Validates transaction metadata
 */
export function validateTransactionMetadata(metadata: any): ValidationResult {
	if (metadata && typeof metadata !== 'object') {
		return { valid: false, error: 'Метаданные транзакции должны быть объектом' };
	}

	if (metadata) {
		// Optional fields validation
		if (metadata.cashierName && typeof metadata.cashierName !== 'string') {
			return { valid: false, error: 'Имя кассира должно быть строкой' };
		}

		if (metadata.terminalId && typeof metadata.terminalId !== 'string') {
			return { valid: false, error: 'ID терминала должен быть строкой' };
		}

		if (metadata.paymentMethod && typeof metadata.paymentMethod !== 'string') {
			return { valid: false, error: 'Способ оплаты должен быть строкой' };
		}

		if (metadata.receiptNumber && typeof metadata.receiptNumber !== 'string') {
			return { valid: false, error: 'Номер чека должен быть строкой' };
		}
	}

	return { valid: true };
}

/**
 * Validate product data for admin panel (Sprint 3 Extended)
 */
export function validateProductData(data: any): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (typeof data.name !== 'string' || data.name.length < 3 || data.name.length > 200) {
		errors.push('Product name must be 3-200 characters');
	}

	// CRITICAL FIX #1 (Sprint 3): Description validation
	if (data.description !== null && data.description !== undefined) {
		if (typeof data.description !== 'string' || data.description.length > 2000) {
			errors.push('Description must be max 2000 characters');
		}
		// XSS protection
		if (/<script|<iframe|javascript:|on\w+=/i.test(data.description)) {
			errors.push('Description contains potentially unsafe HTML');
		}
	}

	// CRITICAL FIX #1 (Sprint 3): Quantity info validation
	if (data.quantityInfo !== null && data.quantityInfo !== undefined) {
		if (typeof data.quantityInfo !== 'string' || data.quantityInfo.length > 100) {
			errors.push('Quantity info must be max 100 characters');
		}
	}

	const price = Number(data.price);
	if (isNaN(price) || price < 0 || price > 1000000) {
		errors.push('Price must be between 0 and 1,000,000');
	}

	if (data.oldPrice !== null && data.oldPrice !== undefined) {
		const oldPrice = Number(data.oldPrice);
		if (isNaN(oldPrice) || oldPrice < 0 || oldPrice > 1000000) {
			errors.push('Old price must be between 0 and 1,000,000');
		}
		if (oldPrice <= price) {
			errors.push('Old price must be greater than current price');
		}
	}

	if (typeof data.category !== 'string' || data.category.length < 2 || data.category.length > 50) {
		errors.push('Category must be 2-50 characters');
	}

	// CRITICAL FIX #1 (Sprint 3): Boolean flags validation
	if (data.showOnHome !== undefined && typeof data.showOnHome !== 'boolean') {
		errors.push('showOnHome must be a boolean');
	}

	if (data.isRecommendation !== undefined && typeof data.isRecommendation !== 'boolean') {
		errors.push('isRecommendation must be a boolean');
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate promotion data for admin panel (Sprint 2 refactored)
 * Required fields: title, description, image, deadline
 * Optional fields: isActive, showOnHome
 */
export function validatePromotionData(data: any): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Title validation
	if (typeof data.title !== 'string' || data.title.length < 3 || data.title.length > 100) {
		errors.push('Title must be 3-100 characters');
	}

	// Description validation
	if (typeof data.description !== 'string' || data.description.length < 10 || data.description.length > 1000) {
		errors.push('Description must be 10-1000 characters');
	}

	// Image validation (URL or path) - HIGH FIX #2 (Cycle 3): Allow null for old data compatibility
	if (data.image !== null && data.image !== undefined) {
		if (typeof data.image !== 'string' || data.image.length < 3 || data.image.length > 500) {
			errors.push('Image URL must be 3-500 characters');
		}

		// XSS protection - block javascript: and data: schemes (CRITICAL FIX #1)
		if (/^(javascript|data):/i.test(data.image.trim())) {
			errors.push('Invalid image URL scheme. Use http:, https:, or file path only.');
		}

		// Additional XSS protection - block < and > characters
		if (/<|>/.test(data.image)) {
			errors.push('Image URL cannot contain < or > characters');
		}
	}

	// Deadline validation (free-form text: "Постоянная акция", "До конца месяца", "2025-12-31", etc.)
	if (typeof data.deadline !== 'string' || data.deadline.length < 3 || data.deadline.length > 50) {
		errors.push('Deadline must be 3-50 characters');
	}
	// No strict date format validation - allow flexible deadline text for better UX

	// Optional: isActive validation
	if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
		errors.push('isActive must be a boolean');
	}

	// Optional: showOnHome validation
	if (data.showOnHome !== undefined && typeof data.showOnHome !== 'boolean') {
		errors.push('showOnHome must be a boolean');
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Validate store data for admin panel
 */
export function validateStoreData(data: any): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (typeof data.name !== 'string' || data.name.length < 3 || data.name.length > 100) {
		errors.push('Store name must be 3-100 characters');
	}

	// Sprint 4 Task 1.4: Add city validation (optional field)
	if (data.city !== null && data.city !== undefined) {
		if (typeof data.city !== 'string' || data.city.length > 100) {
			errors.push('City must be max 100 characters');
		}
		if (/<script|javascript:/i.test(data.city)) {
			errors.push('City contains forbidden content (XSS detected)');
		}
	}

	if (typeof data.address !== 'string' || data.address.length < 10 || data.address.length > 300) {
		errors.push('Address must be 10-300 characters');
	}

	if (typeof data.phone !== 'string' || !/^\+7\d{10}$/.test(data.phone)) {
		errors.push('Phone must be in format +7XXXXXXXXXX');
	}

	if (data.coordinates) {
		const lat = Number(data.coordinates.lat);
		const lng = Number(data.coordinates.lng);
		if (isNaN(lat) || lat < -90 || lat > 90) {
			errors.push('Latitude must be between -90 and 90');
		}
		if (isNaN(lng) || lng < -180 || lng > 180) {
			errors.push('Longitude must be between -180 and 180');
		}
	}

	return { valid: errors.length === 0, errors };
}
