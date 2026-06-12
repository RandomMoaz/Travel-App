export function validateTrip(form) {
  const errors = {};

  if (!form.destination || form.destination.trim().length < 2) {
    errors.destination = "Please enter a destination.";
  }
  if (!form.startDate) errors.startDate = "Start date is required.";
  if (!form.endDate) errors.endDate = "End date is required.";

  if (form.startDate && form.endDate) {
    const a = new Date(form.startDate), b = new Date(form.endDate);
    if (b <= a) errors.endDate = "End date must be after start date.";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (a < today) errors.startDate = "Start date cannot be in the past.";
  }

  const adults = Number(form.adults);
  if (!Number.isInteger(adults) || adults < 1) errors.adults = "At least 1 adult required.";

  const children = Number(form.children);
  if (!Number.isInteger(children) || children < 0) errors.children = "Children cannot be negative.";

  if (!form.interests || form.interests.length === 0) {
    errors.interests = "Please select at least one interest.";
  }

  if (form.budget === "custom") {
    const amt = Number(form.customBudget);
    if (!amt || amt <= 0) errors.customBudget = "Enter a valid custom budget.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export const totalTravelers = (form) => Number(form.adults || 0) + Number(form.children || 0);
