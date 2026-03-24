export type UserAccessStatus = "active" | "locked" | "pending";
export type UserAccessAction = "lock" | "unlock";

export const getUserAccessActions = (status: UserAccessStatus): UserAccessAction[] => {
  if (status === "locked") {
    return ["unlock"];
  }

  if (status === "pending") {
    return ["unlock", "lock"];
  }

  return ["lock"];
};
