import type { TranslationDictionary } from "./types";

/**
 * Translates known backend, service, and validation error messages into the current active language.
 */
export function formatErrorMessage(
  error: unknown,
  t: TranslationDictionary,
): string {
  if (!error) return t.errors.generic;

  const raw =
    typeof error === "string"
      ? error
      : typeof (error as { message?: unknown })?.message === "string"
        ? (error as { message: string }).message
        : "";

  const trimmed = raw.trim();

  // Time entries
  if (trimmed.includes("Time entries cannot be in the future")) {
    return t.errors.futureTime;
  }
  if (trimmed.includes("End time must be after start time")) {
    return t.errors.endAfterStart;
  }
  if (trimmed.includes("longer than 24 hours")) {
    return t.errors.durationTooLong;
  }
  if (trimmed.includes("Time entries cannot overlap")) {
    return t.errors.overlappingTime;
  }

  // Dates & Deadlines
  if (trimmed.includes("Due date cannot be in the past")) {
    return t.errors.pastDeadline;
  }
  if (trimmed.includes("start date must be before the end date")) {
    return t.errors.startDateBeforeEndDate;
  }
  if (trimmed.includes("Past deadlines are not allowed")) {
    return t.errors.pastDeadline;
  }

  // Not found
  if (trimmed.includes("Project not found")) {
    return t.errors.projectNotFound;
  }
  if (trimmed.includes("Task not found in this project")) {
    return t.errors.taskNotFoundInProject;
  }
  if (trimmed.includes("Assigned task not found")) {
    return t.errors.assignedTaskNotFound;
  }
  if (trimmed.includes("Task not found")) {
    return t.errors.taskNotFound;
  }
  if (trimmed.includes("Employee not found")) {
    return t.errors.employeeNotFound;
  }
  if (trimmed.includes("Department not found")) {
    return t.errors.departmentNotFound;
  }

  // Existing records
  if (trimmed.includes("user with this work email already exists") || trimmed.includes("user with this email already exists")) {
    return t.errors.emailAlreadyExists;
  }
  if (trimmed.includes("department with this name already exists")) {
    return t.errors.departmentAlreadyExists;
  }

  // Device & API
  if (trimmed.includes("device registration response was invalid")) {
    return t.errors.invalidDeviceResponse;
  }
  if (trimmed.includes("Invalid employee response")) {
    return t.errors.invalidEmployeeResponse;
  }
  if (trimmed.includes("Invalid email or password") || trimmed.includes("Invalid credentials")) {
    return t.errors.invalidCredentials;
  }
  if (trimmed.includes("Copy is unavailable")) {
    return t.errors.copyUnavailable;
  }

  // Validation
  if (trimmed.includes("Select a valid project")) {
    return t.errors.selectValidProject;
  }
  if (trimmed.includes("Select a valid task")) {
    return t.errors.selectValidTask;
  }
  if (trimmed.includes("Select a valid employee")) {
    return t.errors.selectValidEmployee;
  }
  if (trimmed.includes("Task title must have at least 2 characters")) {
    return t.errors.taskTitleMin;
  }
  if (trimmed.includes("Project name must have at least 2 characters")) {
    return t.errors.projectNameMin;
  }
  if (trimmed.includes("Project code must have at least 2 characters")) {
    return t.errors.projectCodeMin;
  }
  if (trimmed.includes("First name is required")) {
    return t.errors.firstNameRequired;
  }
  if (trimmed.includes("Last name is required")) {
    return t.errors.lastNameRequired;
  }
  if (trimmed.includes("valid email address") || trimmed.includes("Invalid email address") || trimmed.includes("Invalid email")) {
    return t.errors.invalidEmail;
  }
  if (trimmed.includes("Password is required")) {
    return t.errors.passwordMin;
  }
  if (trimmed.includes("Password must be at least 8 characters") || trimmed.includes("shorter than 8 characters") || trimmed.includes("shorter than eight characters")) {
    return t.errors.passwordMin;
  }

  // Actions failure fallbacks
  if (trimmed.includes("Unable to add the time entry")) {
    return t.errors.unableToAddTime;
  }
  if (trimmed.includes("Unable to create the task")) {
    return t.errors.unableToCreateTask;
  }
  if (trimmed.includes("Unable to create the project")) {
    return t.errors.unableToCreateProject;
  }
  if (trimmed.includes("Unable to create the employee")) {
    return t.errors.unableToCreateEmployee;
  }
  if (trimmed.includes("Unable to assign the employee")) {
    return t.errors.unableToAssign;
  }
  if (trimmed.includes("Unable to register the agent device")) {
    return t.errors.unableToRegisterDevice;
  }
  if (trimmed.includes("Unable to save the file mapping")) {
    return t.errors.unableToSaveFileMapping;
  }
  if (trimmed.includes("Unable to update the task")) {
    return t.errors.unableToUpdateTask;
  }
  if (trimmed.includes("Unable to load this report")) {
    return t.errors.unableToLoadReport;
  }
  if (trimmed.includes("Unable to save your changes")) {
    return t.errors.unableToSave;
  }

  return trimmed || t.errors.generic;
}
