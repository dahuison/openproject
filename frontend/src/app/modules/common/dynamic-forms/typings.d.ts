import { FormlyFieldConfig, FormlyTemplateOptions } from "@ngx-formly/core";
import { FormGroup } from "@angular/forms";

export interface IOPDynamicFormSettings {
  fields:IOPFormlyFieldSettings[];
  model:IOPFormModel;
  form:FormGroup;
}

export interface IOPFormlyFieldSettings extends FormlyFieldConfig {
  key?:string;
  type?:OPInputType;
  templateOptions?:IOPFormlyTemplateOptions;
  [key:string]:any;
}

export interface IOPFormlyTemplateOptions extends FormlyTemplateOptions {
  property?:string;
  label?:string;
  hasDefault?:boolean;
  fieldGroup?:string;
  isFieldGroup?:boolean;
  collapsibleFieldGroups?:boolean;
  collapsibleFieldGroupsCollapsed?:boolean;
  helpTextAttributeScope?:string;
  showValidationErrorOn?:'change' | 'blur' | 'submit' | 'never';
  showAddNewUserButton?:boolean;
}

type OPInputType = 'formattableInput'|'selectInput'|'textInput'|'integerInput'|
  'booleanInput'|'dateInput'|'formly-group'|'selectProjectStatusInput';

export interface IOPDynamicInputTypeSettings {
  config:IOPFormlyFieldSettings,
  useForFields:OPFieldType[];
}

export interface IDynamicFieldGroupConfig {
  name:string;
  fieldsFilter?:(fieldProperty:IOPFormlyFieldSettings) => boolean;
  settings?:IOPFormlyFieldSettings;
}
