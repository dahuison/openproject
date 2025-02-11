import { Injectable } from '@angular/core';
import {
  IDynamicFieldGroupConfig,
  IOPDynamicInputTypeSettings,
  IOPFormlyFieldSettings,
} from "../../typings";
import { FormlyFieldConfig } from "@ngx-formly/core";
import { of } from "rxjs";
import { map } from "rxjs/operators";
import { HttpClient } from "@angular/common/http";


@Injectable()
export class DynamicFieldsService {
  readonly inputsCatalogue:IOPDynamicInputTypeSettings[] = [
    {
      config: {
        type: 'textInput',
        templateOptions: {
          type: 'text',
        },
      },
      useForFields: ['String']
    },
    {
      config: {
        type: 'textInput',
        templateOptions: {
          type: 'password',
        },
      },
      useForFields: ['Password']
    },
    {
      config: {
        type: 'integerInput',
        templateOptions: {
          type: 'number',
          locale: I18n.locale,
        },
      },
      useForFields: ['Integer', 'Float']
    },
    {
      config: {
        type: 'booleanInput',
        templateOptions: {
          type: 'checkbox',
        },
      },
      useForFields: ['Boolean']
    },
    {
      config: {
        type: 'dateInput',
      },
      useForFields: ['Date', 'DateTime']
    },
    {
      config: {
        type: 'formattableInput',
        className: '',
        templateOptions: {
          editorType: 'full',
          noWrapLabel: true,
        },
      },
      useForFields: ['Formattable']
    },
    {
      config: {
        type: 'selectInput',
        templateOptions: {
          type: 'number',
          locale: I18n.locale,
          bindLabel: 'name',
          searchable: true,
          virtualScroll: true,
          clearOnBackspace: false,
          clearSearchOnAdd: false,
          hideSelected: false,
          text: {
            add_new_action: I18n.t('js.label_create'),
          },
        },
        expressionProperties: {
          'templateOptions.clearable': (model:any, formState:any, field:FormlyFieldConfig) => !field.templateOptions?.required,
        },
      },
      useForFields: [
        'Priority', 'Status', 'Type', 'User', 'Version', 'TimeEntriesActivity',
        'Category', 'CustomOption', 'Project'
      ]
    },
    {
      config: {
        type: 'selectProjectStatusInput',
        templateOptions: {
          type: 'number',
          locale: I18n.locale,
          bindLabel: 'name',
          searchable: true,
        },
        expressionProperties: {
          'templateOptions.clearable': (model:any, formState:any, field:FormlyFieldConfig) => !field.templateOptions?.required,
        },
      },
      useForFields: [
        'ProjectStatus'
      ]
    },
  ];

  constructor(
    private _httpClient:HttpClient,
  ) {
  }

  getConfig(formSchema:IOPFormSchema, formPayload:IOPFormModel):IOPFormlyFieldSettings[] {
    const formFieldGroups = formSchema._attributeGroups?.map(fieldGroup => ({
      name: fieldGroup.name,
      fieldsFilter: (field:IOPFormlyFieldSettings) => fieldGroup.attributes?.includes(field.templateOptions?.property!),
    }));
    const fieldSchemas = this.getFieldsSchemasWithKey(formSchema);
    const formlyFields = fieldSchemas
      .map(fieldSchema => this.getFormlyFieldConfig(fieldSchema, formPayload))
      .filter(f => f !== null) as IOPFormlyFieldSettings[];
    const formlyFormWithFieldGroups = this.getFormlyFormWithFieldGroups(formFieldGroups, formlyFields);

    return formlyFormWithFieldGroups;
  }

  getModel(formPayload:IOPFormModel):IOPFormModel {
    return this.getFormattedFieldsModel(formPayload);
  }

  getFormattedFieldsModel(formModel:IOPFormModel = {}):IOPFormModel {
    const { _links: resourcesModel, _meta: metaModel, ...otherElementsModel } = formModel;

    const model = {
      ...otherElementsModel,
      _meta: metaModel,
      _links: this.getFormattedResourcesModel(resourcesModel),
    };

    return model;
  }

  getFormlyFormWithFieldGroups(fieldGroups:IDynamicFieldGroupConfig[] = [], formFields:IOPFormlyFieldSettings[] = []):IOPFormlyFieldSettings[] {
    const fomFieldsWithoutGroup = formFields.filter(formField => fieldGroups.every(fieldGroup => !fieldGroup.fieldsFilter || !fieldGroup.fieldsFilter(formField)));
    const formFieldGroups = this.getDynamicFormFieldGroups(fieldGroups, formFields);

    return [...fomFieldsWithoutGroup, ...formFieldGroups];
  }

  private getFieldsSchemasWithKey(formSchema:IOPFormSchema):IOPFieldSchemaWithKey[] {
    return Object.keys(formSchema)
      .map(fieldSchemaKey => {
        const fieldSchema = {
          ...formSchema[fieldSchemaKey],
          key: this.getAttributeKey(formSchema[fieldSchemaKey], fieldSchemaKey)
        };

        return fieldSchema;
      })
      .filter(fieldSchema => this.isFieldSchema(fieldSchema) && fieldSchema.writable);
  }

  private getAttributeKey(fieldSchema:IOPFieldSchema, key:string):string {
    switch (fieldSchema.location) {
      case "_links":
      case "_meta":
        return `${fieldSchema.location}.${key}`;
      default:
        return key;
    }
  }

  private isFieldSchema(schemaValue:IOPFieldSchemaWithKey|any):boolean {
    return !!schemaValue?.type;
  }

  private getFormattedResourcesModel(resourcesModel:IOPFormModel['_links'] = {}):IOPFormModel['_links'] {
    return Object.keys(resourcesModel).reduce((result, resourceKey) => {
      const resource = resourcesModel[resourceKey];
      // ng-select needs a 'name' in order to show the label
      // We need to add it in case of the form payload (HalLinkSource)
      const resourceModel = Array.isArray(resource) ?
        resource.map(resourceElement => resourceElement?.href && {
          ...resourceElement,
          name: resourceElement?.name || resourceElement?.title
        }) :
        resource?.href && { ...resource, name: resource?.name || resource?.title };

      result = {
        ...result,
        [resourceKey]: resourceModel,
      };

      return result;
    }, {});
  }

  private getFormlyFieldConfig(fieldSchema:IOPFieldSchemaWithKey, formPayload:IOPFormModel):IOPFormlyFieldSettings|null {
    const { key, name: label, required, hasDefault, minLength, maxLength } = fieldSchema;
    const fieldTypeConfigSearch = this.getFieldTypeConfig(fieldSchema);
    if (!fieldTypeConfigSearch) {
      return null;
    }
    const { templateOptions, ...fieldTypeConfig } = fieldTypeConfigSearch;
    const fieldOptions = this.getFieldOptions(fieldSchema);
    const property = this.getFieldProperty(key);
    const payloadValue = property && formPayload[property];
    const formlyFieldConfig = {
      ...fieldTypeConfig,
      key,
      wrappers: ['op-dynamic-field-wrapper'],
      className: `op-form--field ${fieldTypeConfig?.className || ''}`,
      templateOptions: {
        property,
        required,
        label,
        hasDefault,
        ...payloadValue != null && { payloadValue },
        ...minLength && { minLength },
        ...maxLength && { maxLength },
        ...templateOptions,
        ...fieldOptions && { options: fieldOptions },
      },
    };

    return formlyFieldConfig;
  }

  private getFieldTypeConfig(field:IOPFieldSchemaWithKey):IOPFormlyFieldSettings|null {
    const fieldType = field.type.replace('[]', '') as OPFieldType;
    let inputType = this.inputsCatalogue.find(inputType => inputType.useForFields.includes(fieldType))!;

    if (!inputType) {
      console.warn(
        `Could not find a input definition for a field with the folowing type: ${fieldType}. The full field configuration is`, field
      );
      return null;
    }

    let inputConfig = inputType.config;
    let configCustomizations;

    if (inputConfig.type === 'integerInput' || inputConfig.type === 'selectInput' || inputConfig.type === 'selectProjectStatusInput') {
      configCustomizations = {
        className: field.name,
        templateOptions: {
          ...inputConfig.templateOptions,
          ...field.type.startsWith('[]') && {multiple: true},
          ...fieldType === 'User' && {showAddNewUserButton: true},
        },
      };
    } else if (inputConfig.type === 'formattableInput') {
      configCustomizations = {
        templateOptions: {
          ...inputConfig.templateOptions,
          rtl: field.options?.rtl,
          name: field.name,
        },
      };
    }

    return { ...inputConfig, ...configCustomizations };
  }

  private getFieldOptions(field:IOPFieldSchemaWithKey) {
    const allowedValues = field._embedded?.allowedValues || field._links?.allowedValues;

    if (!allowedValues) {
      return;
    }

    if (Array.isArray(allowedValues)) {
      const options = allowedValues[0]?._links?.self?.title ?
        this.formatAllowedValues(allowedValues) :
        allowedValues;

      return of(options);
    } else if (allowedValues!.href) {
      return this._httpClient
        .get(allowedValues!.href!)
        .pipe(
          map((response:api.v3.Result) => response._embedded.elements),
          map(options => this.formatAllowedValues(options)),
        );
    }

    return;
  }

  // ng-select needs a 'name' in order to show the label
  // We need to add it in case of the form payload (HalLinkSource)
  private formatAllowedValues(options:IOPAllowedValue[]) {
    return options.map((option:IOPFieldSchema['options']) => ({ ...option, name: option._links?.self?.title }));
  }

  // Map a field key that may be a _links.property to the property name
  private getFieldProperty(key:string) {
    return key.split('.').pop();
  }

  private getDynamicFormFieldGroups(fieldGroups:IDynamicFieldGroupConfig[] = [], formFields:IOPFormlyFieldSettings[] = []) {
    return fieldGroups.reduce((formWithFieldGroups:IOPFormlyFieldSettings[], fieldGroup) => {
      let newFormFieldGroup = this.getDefaultFieldGroupSettings(fieldGroup, formFields);

      if (fieldGroup.settings) {
        newFormFieldGroup = {
          ...newFormFieldGroup,
          templateOptions: {
            ...newFormFieldGroup.templateOptions,
            ...fieldGroup.settings.templateOptions && fieldGroup.settings.templateOptions,
          },
          expressionProperties: {
            ...newFormFieldGroup.expressionProperties,
            ...fieldGroup.settings.expressionProperties && fieldGroup.settings.expressionProperties,
          }
        }
      }

      if (newFormFieldGroup?.fieldGroup?.length) {
        formWithFieldGroups = [...formWithFieldGroups, newFormFieldGroup];
      }

      return formWithFieldGroups;
    }, []);
  }

  private getDefaultFieldGroupSettings(fieldGroupConfig:IDynamicFieldGroupConfig, formFields:IOPFormlyFieldSettings[]):IOPFormlyFieldSettings {
    const defaultFieldGroupSettings = {
      wrappers: ['op-dynamic-field-group-wrapper'],
      fieldGroupClassName: 'op-form--fieldset',
      templateOptions: {
        label: fieldGroupConfig.name,
        isFieldGroup: true,
        collapsibleFieldGroups: true,
        collapsibleFieldGroupsCollapsed: true,
      },
      fieldGroup: this.getGroupFields(fieldGroupConfig, formFields),
      expressionProperties: {
        'templateOptions.collapsibleFieldGroupsCollapsed': this.collapsibleFieldGroupsCollapsedExpressionProperty
      }
    };

    return defaultFieldGroupSettings;
  }

  private getGroupFields(fieldGroupConfig:IDynamicFieldGroupConfig, formFields:IOPFormlyFieldSettings[]) {
    return formFields.filter(formField => {
      const formFieldKey = formField.key && this.getFieldProperty(formField.key);

      if (!formFieldKey) {
        return false;
      } else if (fieldGroupConfig.fieldsFilter) {
        return fieldGroupConfig.fieldsFilter(formField);
      } else {
        return true;
      }
    })
  }

  private collapsibleFieldGroupsCollapsedExpressionProperty(model:any, formState:any, field:FormlyFieldConfig) {
    // Uncollapse field groups when the form has errors and is submitted
    if (
      field.type !== 'formly-group' ||
      !field.templateOptions?.collapsibleFieldGroups ||
      !field.templateOptions?.collapsibleFieldGroupsCollapsed
    ) {
      return;
    } else {
      return !(
        field.fieldGroup?.some((groupField:IOPFormlyFieldSettings) =>
          groupField.formControl?.errors &&
          !groupField.hide &&
          field.options?.parentForm?.submitted
        ));
    }
  }
}

