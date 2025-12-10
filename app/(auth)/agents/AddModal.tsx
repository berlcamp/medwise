"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hook";
import { addItem, updateList } from "@/lib/redux/listSlice";
import { supabase2 } from "@/lib/supabase/admin";
import { supabase } from "@/lib/supabase/client";
import { Agent } from "@/types";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Car,
  CheckCircle,
  Loader2,
  Mail,
  MapPin,
  Phone,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

const table = "agents";
const title = "Agent";

const FormSchema = z.object({
  name: z.string().min(1, "Agent Name is required"),
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  area: z.string().optional(),
  contact_number: z.string().optional(),
  vehicle_plate_number: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

type FormType = z.infer<typeof FormSchema>;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  editData?: Agent | null;
  onAdded?: (newAgent: Agent) => void;
}

export const AddModal = ({
  isOpen,
  onClose,
  editData,
  onAdded,
}: ModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dispatch = useAppDispatch();

  const selectedBranchId = useAppSelector(
    (state) => state.branch.selectedBranchId
  );

  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: editData ? editData.name : "",
      email: editData ? editData.email || "" : "",
      area: editData ? editData.area || "" : "",
      contact_number: editData ? editData.contact_number || "" : "",
      vehicle_plate_number: editData ? editData.vehicle_plate_number || "" : "",
      status: editData ? editData.status : "active",
    },
  });

  const onSubmit = async (data: FormType) => {
    if (isSubmitting) return;

    if (!selectedBranchId) {
      toast.error("Please select a branch first");
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if email already exists in agents table (for new agents or if email changed)
      if (!editData || (editData && editData.email !== data.email)) {
        const { data: existingAgent } = await supabase
          .from("agents")
          .select("id")
          .eq("email", data.email.trim())
          .maybeSingle();

        if (existingAgent) {
          form.setError("email", {
            type: "manual",
            message: "Email already exists for another agent",
          });
          setIsSubmitting(false);
          return;
        }

        // Check if email exists in users table
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", data.email.trim())
          .maybeSingle();

        if (existingUser) {
          form.setError("email", {
            type: "manual",
            message: "Email already exists in the system",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // When editing, preserve the original branch_id to maintain branch-level isolation
      const branchIdToUse = editData?.branch_id || selectedBranchId;

      const newData = {
        name: data.name.trim(),
        email: data.email.trim(),
        area: data.area || null,
        contact_number: data.contact_number || null,
        vehicle_plate_number: data.vehicle_plate_number || null,
        status: data.status,
        branch_id: branchIdToUse,
        org_id: Number(process.env.NEXT_PUBLIC_ORG_ID),
      };

      if (editData?.id) {
        // Update agent
        const { error: agentError } = await supabase
          .from(table)
          .update(newData)
          .eq("id", editData.id);

        if (agentError) {
          throw new Error(agentError.message);
        }

        // Update user record if email changed
        if (editData.email !== data.email) {
          const { error: userError } = await supabase
            .from("users")
            .update({
              name: data.name.trim(),
              email: data.email.trim(),
              is_active: data.status === "active",
            })
            .eq("email", editData.email);

          if (userError) {
            console.error("Error updating user:", userError);
            // Don't throw, just log - agent is updated
          }
        } else {
          // Update user name and status even if email didn't change
          const { error: userError } = await supabase
            .from("users")
            .update({
              name: data.name.trim(),
              is_active: data.status === "active",
            })
            .eq("email", data.email.trim());

          if (userError) {
            console.error("Error updating user:", userError);
          }
        }

        dispatch(updateList({ ...newData, id: editData.id }));
        onClose();
      } else {
        // 🔹 Step 1: Get or create auth user (similar to staff AddModal)
        const { data: authUserId, error: authError } = await supabase.rpc(
          "get_user_id_by_email",
          { p_email: data.email.trim() }
        );

        if (authError)
          throw new Error(`Error fetching auth user: ${authError.message}`);

        let user_id = authUserId;

        // 🔹 Step 2: If no auth user found, create one
        if (!user_id) {
          const { data: newAuth, error: createAuthError } =
            await supabase2.auth.admin.createUser({
              email: data.email.trim(),
              email_confirm: true,
              password:
                process.env.NEXT_PUBLIC_DEFAULT_PASSWORD || "Password123!",
            });

          if (createAuthError)
            throw new Error(
              `Error creating auth user: ${createAuthError.message}`
            );

          user_id = newAuth.user.id;
        }

        // 🔹 Step 3: Create agent record
        const { data: inserted, error: agentError } = await supabase
          .from(table)
          .insert([newData])
          .select()
          .single();

        if (agentError) {
          throw new Error(agentError.message);
        }

        // 🔹 Step 4: Create user record for agent
        try {
          const { error: userError } = await supabase.from("users").insert({
            name: data.name.trim(),
            email: data.email.trim(),
            user_id,
            type: "agent",
            branch_id: branchIdToUse,
            org_id: Number(process.env.NEXT_PUBLIC_ORG_ID),
            is_active: data.status === "active",
          });

          if (userError) {
            console.error("Error creating user for agent:", userError);
            // Rollback agent creation
            await supabase.from(table).delete().eq("id", inserted.id);
            throw new Error(
              `Failed to create user record: ${userError.message}`
            );
          }
        } catch (userErr) {
          // Rollback agent creation if user creation fails
          await supabase.from(table).delete().eq("id", inserted.id);
          throw userErr;
        }

        if (onAdded) {
          onAdded(inserted);
        } else {
          dispatch(addItem({ ...newData, id: inserted.id }));
        }
        onClose();
      }

      toast.success("Successfully saved!");
    } catch (err) {
      console.error("Submission error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      toast.error(`Failed to save: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (editData) {
      form.reset({
        name: editData.name,
        email: editData.email || "",
        area: editData.area || "",
        contact_number: editData.contact_number || "",
        vehicle_plate_number: editData.vehicle_plate_number || "",
        status: editData.status,
      });
    } else {
      form.reset({
        name: "",
        email: "",
        area: "",
        contact_number: "",
        vehicle_plate_number: "",
        status: "active",
      });
    }
  }, [form, editData, isOpen]);

  return (
    <Dialog
      open={isOpen}
      as="div"
      className="relative z-50 focus:outline-none"
      onClose={() => {}}
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel transition className="app__modal_dialog_panel_sm">
          <div className="app__modal_dialog_title_container">
            <DialogTitle
              as="h3"
              className="text-lg font-semibold flex items-center gap-2"
            >
              <div className="p-1.5 rounded-lg bg-blue-500/20">
                <User className="h-5 w-5 text-blue-300" />
              </div>
              {editData ? "Edit" : "Create"} {title}
            </DialogTitle>
          </div>
          <div className="app__modal_dialog_content">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* Basic Information Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950">
                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      Basic Information
                    </CardTitle>
                    <CardDescription>
                      Enter the agent&apos;s personal details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            Agent Name
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 transition-all focus:ring-2 focus:ring-blue-500/20"
                              placeholder="e.g., John Doe"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            Email Address (Use for login)
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              className="h-11 transition-all focus:ring-2 focus:ring-blue-500/20"
                              placeholder="e.g., john.doe@example.com"
                              disabled={!!editData}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          {editData && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Email cannot be changed for existing agents
                            </p>
                          )}
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="area"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            Assigned Area
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="h-11 transition-all focus:ring-2 focus:ring-blue-500/20"
                              placeholder="e.g., Downtown, North Zone"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Contact & Vehicle Information Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950">
                        <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      Contact & Vehicle Details
                    </CardTitle>
                    <CardDescription>
                      Provide contact information and vehicle details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contact_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              Contact Number
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="h-11 transition-all focus:ring-2 focus:ring-blue-500/20"
                                placeholder="e.g., +1 (555) 123-4567"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="vehicle_plate_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium flex items-center gap-2">
                              <Car className="h-3.5 w-3.5 text-muted-foreground" />
                              Vehicle Plate Number
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="h-11 transition-all focus:ring-2 focus:ring-blue-500/20"
                                placeholder="e.g., ABC-1234"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Status Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div
                        className={`p-1.5 rounded-lg ${
                          form.watch("status") === "active"
                            ? "bg-green-50 dark:bg-green-950"
                            : "bg-gray-100 dark:bg-gray-800"
                        }`}
                      >
                        {form.watch("status") === "active" ? (
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                      Status
                    </CardTitle>
                    <CardDescription>
                      Set the agent&apos;s active status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Agent Status
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 transition-all focus:ring-2 focus:ring-blue-500/20">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                Active
                              </SelectItem>
                              <SelectItem value="inactive">
                                <XCircle className="h-4 w-4 text-gray-500" />
                                Inactive
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                          {form.watch("status") === "active" && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Agent will be available for new assignments
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="app__modal_dialog_footer pt-4">
                  <Button
                    type="button"
                    onClick={onClose}
                    variant="outline"
                    className="min-w-[100px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : editData ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Update Agent
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Create Agent
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
