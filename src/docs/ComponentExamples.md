# Ejemplos de Componentes Ahorro Invisible

Este documento proporciona ejemplos prácticos de uso de los componentes del sistema de diseño de Ahorro Invisible.

## Componentes Básicos

### Button

```tsx
import { Button } from '@/components/ui/Button';

// Variantes
<Button variant="primary">Botón Primario</Button>
<Button variant="secondary">Botón Secundario</Button>
<Button variant="outline">Botón Outline</Button>
<Button variant="ghost">Botón Ghost</Button>
<Button variant="danger">Botón Peligro</Button>

// Tamaños
<Button variant="primary" size="sm">Botón Pequeño</Button>
<Button variant="primary" size="md">Botón Mediano</Button>
<Button variant="primary" size="lg">Botón Grande</Button>

// Con icono
<Button variant="primary" icon={<PlusIcon />}>Nuevo</Button>

// Solo icono
<Button variant="primary" iconOnly><PlusIcon /></Button>

// Ancho completo
<Button variant="primary" fullWidth>Botón Ancho Completo</Button>

// Deshabilitado
<Button variant="primary" disabled>Botón Deshabilitado</Button>
```

### Card

```tsx
import { Card } from '@/components/ui/Card';

// Básica
<Card>
  <p>Contenido de la tarjeta</p>
</Card>

// Con título
<Card>
  <Card.Header title="Título de la tarjeta" />
  <Card.Content>
    <p>Contenido de la tarjeta</p>
  </Card.Content>
</Card>

// Con footer
<Card>
  <Card.Header title="Título de la tarjeta" />
  <Card.Content>
    <p>Contenido de la tarjeta</p>
  </Card.Content>
  <Card.Footer>
    <Button variant="primary">Acción</Button>
  </Card.Footer>
</Card>

// Variantes
<Card variant="default">Tarjeta Default</Card>
<Card variant="primary">Tarjeta Primary</Card>
<Card variant="success">Tarjeta Success</Card>
<Card variant="highlight">Tarjeta Highlight</Card>
<Card variant="gradient">Tarjeta Gradient</Card>

// Tamaños
<Card size="sm">Tarjeta Pequeña</Card>
<Card size="md">Tarjeta Mediana</Card>
<Card size="lg">Tarjeta Grande</Card>
<Card size="none">Tarjeta Sin Padding</Card>

// Interactiva
<Card interactive>Tarjeta Interactiva</Card>

// Bordes redondeados
<Card rounded2xl>Tarjeta con Bordes Más Redondeados</Card>

// Sombras
<Card shadowMd>Tarjeta con Sombra Media</Card>
<Card shadowBlue>Tarjeta con Sombra Azul</Card>
```

### Badge

```tsx
import { Badge } from '@/components/ui/Badge';

// Variantes
<Badge variant="default">Default</Badge>
<Badge variant="primary">Primary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="danger">Danger</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="solid">Solid</Badge>

// Tamaños
<Badge variant="primary" size="sm">Pequeño</Badge>
<Badge variant="primary" size="md">Mediano</Badge>
<Badge variant="primary" size="lg">Grande</Badge>

// Con punto
<Badge variant="success" withDot>Con Punto</Badge>

// Con punto animado
<Badge variant="success" withDot pulse>Con Punto Animado</Badge>

// Formas
<Badge variant="primary" shape="rounded">Redondeado</Badge>
<Badge variant="primary" shape="pill">Pill</Badge>

// Estilos de texto
<Badge variant="primary" uppercase>Mayúsculas</Badge>
<Badge variant="primary" bold>Negrita</Badge>

// Con icono
<Badge variant="primary" icon={<CheckIcon />}>Con Icono</Badge>
```

### Progress

```tsx
import { Progress } from '@/components/ui/Progress';

// Básico
<Progress value={50} />

// Variantes
<Progress value={50} variant="primary" />
<Progress value={50} variant="success" />
<Progress value={50} variant="danger" />
<Progress value={50} variant="warning" />
<Progress value={50} variant="gradient" />

// Tamaños
<Progress value={50} size="xs" />
<Progress value={50} size="sm" />
<Progress value={50} size="md" />
<Progress value={50} size="lg" />
<Progress value={50} size="xl" />

// Con etiqueta
<Progress value={50} showLabel />

// Con etiqueta personalizada
<Progress 
  value={50} 
  showLabel 
  label="Progreso" 
  valueFormatter={(value, max) => `${value}/${max}`} 
/>

// Rayas
<Progress value={50} striped />

// Rayas animadas
<Progress value={50} striped animated />
```

## Componentes Avanzados

### Modal

```tsx
import { Modal } from '@/components/ui/Modal';
import { useState } from 'react';

function ModalExample() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Abrir Modal
      </Button>
      
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Título del Modal"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary">
              Confirmar
            </Button>
          </div>
        }
      >
        <p>Contenido del modal...</p>
      </Modal>
    </>
  );
}
```

### Dropdown

```tsx
import { Dropdown } from '@/components/ui/Dropdown';
import { useState } from 'react';

function DropdownExample() {
  const [value, setValue] = useState('');
  
  return (
    <Dropdown
      placeholder="Seleccionar"
      value={value}
      onChange={setValue}
      items={[
        { value: 'option1', label: 'Opción 1' },
        { value: 'option2', label: 'Opción 2' },
        { value: 'option3', label: 'Opción 3', disabled: true },
      ]}
    />
  );
}

function DropdownMenuExample() {
  return (
    <Dropdown.Menu
      trigger={<Button variant="outline">Acciones</Button>}
      alignRight
    >
      <Dropdown.Header>Acciones</Dropdown.Header>
      <Dropdown.Item onClick={() => console.log('Editar')}>
        Editar
      </Dropdown.Item>
      <Dropdown.Item onClick={() => console.log('Duplicar')}>
        Duplicar
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => console.log('Eliminar')}>
        Eliminar
      </Dropdown.Item>
    </Dropdown.Menu>
  );
}
```

### Table

```tsx
import { Table } from '@/components/ui/Table';
import { useState } from 'react';

function TableExample() {
  const [sortKey, setSortKey] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const data = [
    { id: '1', name: 'Juan', email: 'juan@example.com', age: 30 },
    { id: '2', name: 'María', email: 'maria@example.com', age: 25 },
    { id: '3', name: 'Pedro', email: 'pedro@example.com', age: 35 },
  ];
  
  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSortKey(key);
    setSortOrder(order);
    // Aquí iría la lógica para ordenar los datos
  };
  
  return (
    <Table
      data={data}
      columns={[
        {
          key: 'name',
          title: 'Nombre',
          sortable: true,
        },
        {
          key: 'email',
          title: 'Email',
        },
        {
          key: 'age',
          title: 'Edad',
          align: 'right',
          sortable: true,
        },
        {
          key: 'actions',
          title: 'Acciones',
          align: 'right',
          render: (_, record) => (
            <Button variant="outline" size="sm">
              Ver
            </Button>
          ),
        },
      ]}
      rowKey="id"
      striped
      hoverable
      pagination={{
        pageSize: 10,
        total: data.length,
      }}
      onSort={handleSort}
      sortKey={sortKey}
      sortOrder={sortOrder}
    />
  );
}
```

### Form

```tsx
import { Form } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';

function FormExample() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    bio: '',
    country: '',
    terms: false,
    notifications: 'email',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData({
      ...formData,
      [name]: val,
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación
    const newErrors: Record<string, string> = {};
    
    if (!formData.name) {
      newErrors.name = 'El nombre es obligatorio';
    }
    
    if (!formData.email) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }
    
    if (!formData.password) {
      newErrors.password = 'La contraseña es obligatoria';
    } else if (formData.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }
    
    if (!formData.terms) {
      newErrors.terms = 'Debes aceptar los términos y condiciones';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      // Enviar formulario
      console.log('Formulario enviado', formData);
    }
  };
  
  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group>
        <Form.Label htmlFor="name" required>Nombre</Form.Label>
        <Form.Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
        />
      </Form.Group>
      
      <Form.Group>
        <Form.Label htmlFor="email" required>Email</Form.Label>
        <Form.InputGroup>
          <Form.Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
          />
          <Form.InputGroup.Addon>@example.com</Form.InputGroup.Addon>
        </Form.InputGroup>
      </Form.Group>
      
      <Form.Group>
        <Form.Label htmlFor="password" required>Contraseña</Form.Label>
        <Form.Input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
        />
        <Form.Hint>La contraseña debe tener al menos 8 caracteres</Form.Hint>
      </Form.Group>
      
      <Form.Group>
        <Form.Label htmlFor="confirmPassword" required>Confirmar Contraseña</Form.Label>
        <Form.Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />
      </Form.Group>
      
      <Form.Group>
        <Form.Label htmlFor="bio">Biografía</Form.Label>
        <Form.Textarea
          id="bio"
          name="bio"
          value={formData.bio}
          onChange={handleChange}
        />
      </Form.Group>
      
      <Form.Group>
        <Form.Label htmlFor="country">País</Form.Label>
        <Form.Select
          id="country"
          name="country"
          value={formData.country}
          onChange={handleChange}
          options={[
            { value: '', label: 'Seleccionar país', disabled: true },
            { value: 'es', label: 'España' },
            { value: 'mx', label: 'México' },
            { value: 'ar', label: 'Argentina' },
            { value: 'co', label: 'Colombia' },
          ]}
        />
      </Form.Group>
      
      <Form.Group>
        <Form.Label>Notificaciones</Form.Label>
        <div className="space-y-2">
          <Form.Radio
            id="notifications-email"
            name="notifications"
            value="email"
            label="Email"
            checked={formData.notifications === 'email'}
            onChange={handleChange}
          />
          <Form.Radio
            id="notifications-sms"
            name="notifications"
            value="sms"
            label="SMS"
            checked={formData.notifications === 'sms'}
            onChange={handleChange}
          />
          <Form.Radio
            id="notifications-none"
            name="notifications"
            value="none"
            label="Ninguna"
            checked={formData.notifications === 'none'}
            onChange={handleChange}
          />
        </div>
      </Form.Group>
      
      <Form.Group>
        <Form.Checkbox
          id="terms"
          name="terms"
          label="Acepto los términos y condiciones"
          checked={formData.terms}
          onChange={handleChange}
          error={errors.terms}
        />
      </Form.Group>
      
      <Form.Actions>
        <Button variant="outline" type="button">
          Cancelar
        </Button>
        <Button variant="primary" type="submit">
          Registrarse
        </Button>
      </Form.Actions>
    </Form>
  );
}
```

## Layout

### AppLayout

```tsx
import { AppLayout } from '@/components/layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

function DashboardPage() {
  return (
    <AppLayout
      title="Dashboard"
      subtitle="Bienvenido a tu panel de control"
    >
      <AppLayout.Section title="Resumen">
        <AppLayout.Grid columns={3}>
          <Card>
            <Card.Content>
              <h3 className="text-lg font-medium mb-2">Total Ahorrado</h3>
              <p className="text-3xl font-bold">1.500€</p>
            </Card.Content>
          </Card>
          
          <Card>
            <Card.Content>
              <h3 className="text-lg font-medium mb-2">Objetivo</h3>
              <p className="text-3xl font-bold">5.000€</p>
            </Card.Content>
          </Card>
          
          <Card>
            <Card.Content>
              <h3 className="text-lg font-medium mb-2">Progreso</h3>
              <p className="text-3xl font-bold">30%</p>
            </Card.Content>
          </Card>
        </AppLayout.Grid>
      </AppLayout.Section>
      
      <AppLayout.Section title="Objetivos">
        <Card>
          <Card.Header title="Mis Objetivos" />
          <Card.Content>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Viaje a Japón</h4>
                  <p className="text-sm text-gray-500">12 meses</p>
                </div>
                <Badge variant="primary">Principal</Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Nuevo Ordenador</h4>
                  <p className="text-sm text-gray-500">6 meses</p>
                </div>
                <Badge variant="default">Secundario</Badge>
              </div>
            </div>
          </Card.Content>
          <Card.Footer>
            <Button variant="primary">Nuevo Objetivo</Button>
          </Card.Footer>
        </Card>
      </AppLayout.Section>
      
      <AppLayout.Grid columns={12}>
        <div className="lg:col-span-8">
          <Card>
            <Card.Header title="Evolución del Ahorro" />
            <Card.Content>
              {/* Gráfico */}
              <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
                Gráfico
              </div>
            </Card.Content>
          </Card>
        </div>
        
        <div className="lg:col-span-4">
          <Card variant="gradient">
            <Card.Content>
              <h3 className="text-2xl font-bold mb-2 text-white">Tu Ahorro es<br/>imparable.</h3>
              <p className="text-white/80 mb-1">Intensidad:</p>
              <p className="text-white font-medium mb-6">MEDIUM - ¡Vas por<br/>buen camino!</p>
              
              <Button variant="outline" className="bg-white/20 border-white/30 text-white">
                Ajustar Reglas
              </Button>
            </Card.Content>
          </Card>
        </div>
      </AppLayout.Grid>
    </AppLayout>
  );
}
```

## Temas

### ThemeToggle

```tsx
import { ThemeToggle } from '@/components/ui/ThemeToggle';

function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      <h1 className="text-xl font-bold">Mi Aplicación</h1>
      <ThemeToggle />
    </header>
  );
}
```

### Uso Programático

```tsx
import { applyTheme, getTheme, initTheme } from '@/styles/themes';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Inicializar tema
    initTheme();
    
    // Obtener tema actual
    const currentTheme = getTheme();
    console.log('Tema actual:', currentTheme);
  }, []);
  
  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    applyTheme(theme);
  };
  
  return (
    <div>
      <button onClick={() => handleThemeChange('light')}>Tema Claro</button>
      <button onClick={() => handleThemeChange('dark')}>Tema Oscuro</button>
      <button onClick={() => handleThemeChange('system')}>Tema del Sistema</button>
    </div>
  );
}
```
