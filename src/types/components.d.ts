/**
 * Definiciones de tipos para los componentes del sistema de diseño
 */

import { ButtonProps } from '@/components/ui/Button/Button';
import { CardProps, CardHeaderProps, CardContentProps, CardFooterProps } from '@/components/ui/Card/Card';
import { BadgeProps } from '@/components/ui/Badge/Badge';
import { ProgressProps } from '@/components/ui/Progress/Progress';
import { ModalProps } from '@/components/ui/Modal/Modal';
import { DropdownProps } from '@/components/ui/Dropdown/Dropdown';
import { TableProps, TableColumn } from '@/components/ui/Table/Table';
import { 
  FormProps, FormGroupProps, FormLabelProps, FormInputProps, 
  FormTextareaProps, FormSelectProps, FormCheckboxProps, 
  FormRadioProps, FormErrorProps, FormHintProps, FormActionsProps,
  FormInputGroupProps
} from '@/components/ui/Form/Form';

// Extender el namespace global para incluir los tipos de los componentes
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Añadir aquí cualquier elemento personalizado si es necesario
    }
  }
}

// Exportar todos los tipos para que estén disponibles en toda la aplicación
export {
  ButtonProps,
  CardProps,
  CardHeaderProps,
  CardContentProps,
  CardFooterProps,
  BadgeProps,
  ProgressProps,
  ModalProps,
  DropdownProps,
  TableProps,
  TableColumn,
  FormProps,
  FormGroupProps,
  FormLabelProps,
  FormInputProps,
  FormTextareaProps,
  FormSelectProps,
  FormCheckboxProps,
  FormRadioProps,
  FormErrorProps,
  FormHintProps,
  FormActionsProps,
  FormInputGroupProps
};
