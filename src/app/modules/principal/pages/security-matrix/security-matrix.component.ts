import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

export interface MenuNode {
  id: number;
  parentId: number | null;
  title: string;
  icon: string | null;
  path: string | null;
  orderIndex: number;
  children?: MenuNode[]; // Hijos anidados de este módulo
}

@Component({
  selector: 'app-security-matrix',
  templateUrl: './security-matrix.component.html',
  styleUrls: ['./security-matrix.component.css']
})
export class SecurityMatrixComponent implements OnInit {
  // Catálogos e instancias de selección
  rolesList: any[] = [];
  selectedRole: any = null;

  // Árbol jerárquico de menús estructurado en memoria RAM
  menuTree: MenuNode[] = [];
  
  // Set de IDs seleccionados para manipulación instantánea sin duplicados
  checkedOptionIds = new Set<number>();

  // Estados de carga e interfaz
  isLoadingRoles = false;
  isLoadingMatrix = false;
  isSaving = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRolesCatalog();
  }

  // 📡 1. Jalar todos los roles multi-tenant de tu empresa en Aiven
  loadRolesCatalog(): void {
    this.isLoadingRoles = true;
    this.cdr.detectChanges();

    this.http.get<{ data: any[] }>(`${environment.apiUrl}/security/roles`).subscribe({
      next: (res) => {
        this.rolesList = res?.data || [];
        this.isLoadingRoles = false;
        
        // Selección automática del primer rol de la lista para agilizar la UX
        if (this.rolesList.length > 0) {
          this.selectRole(this.rolesList[0]);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingRoles = false;
        this.errorMessage = 'Error cargando catálogo de perfiles comerciales.';
        this.cdr.detectChanges();
      }
    });
  }

  // 🔄 2. Evento gatillado al dar click a una tarjeta de Rol
  selectRole(role: any): void {
    this.selectedRole = role;
    this.checkedOptionIds.clear();
    this.isLoadingMatrix = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.cdr.detectChanges();

    // Consultamos la matriz cruzada de tu endpoint /permissions/:roleId
    this.http.get<{ data: { allMenuOptions: any[], checkedMenuOptionIds: number[] } }>(
      `${environment.apiUrl}/security/permissions/${role.id}`
    ).subscribe({
      next: (res) => {
        const rawOptions = res?.data?.allMenuOptions || [];
        const checkedIds = res?.data?.checkedMenuOptionIds || [];

        // Estructuramos el árbol jerárquico relacionando p.id === h.parentId
        this.menuTree = this.buildHierarchyTree(rawOptions);
        
        // Poblamos el Set en RAM con los checks activos guardados en la BD
        checkedIds.forEach(id => this.checkedOptionIds.add(id));

        this.isLoadingMatrix = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingMatrix = false;
        this.errorMessage = 'Error al sincronizar los privilegios del rol.';
        this.cdr.detectChanges();
      }
    });
  }

  // 🌳 3. Algoritmo Maestro de Estructuración de Árboles (Odoo Pattern)
  private buildHierarchyTree(flatOptions: any[]): MenuNode[] {
    const map = new Map<number, MenuNode>();
    const roots: MenuNode[] = [];

    // Mapeamos todas las filas en objetos tipados con inicializador de hijos vacíos
    flatOptions.forEach(opt => {
      map.set(opt.id, { ...opt, children: [] });
    });

    // Barremos el mapa engranando los hijos adentro de sus respectivos padres
    flatOptions.forEach(opt => {
      const node = map.get(opt.id)!;
      if (opt.parentId === null || opt.parentId === undefined) {
        roots.push(node); // Es un módulo raíz de primer nivel
      } else {
        const parentNode = map.get(Number(opt.parentId));
        if (parentNode) {
          parentNode.children!.push(node); // Inyección en cascada
        } else {
          roots.push(node); // Fallback defensivo si el padre fue borrado
        }
      }
    });

    // Ordenamos las ramas según tu columna orderIndex de MySQL
    const sorter = (a: MenuNode, b: MenuNode) => a.orderIndex - b.orderIndex;
    roots.forEach(r => r.children!.sort(sorter));
    return roots.sort(sorter);
  }

  // 🔲 4. Gestor Reactivo de los Checkboxes
  onCheckToggle(optionId: number, isChecked: boolean): void {
    if (isChecked) {
      this.checkedOptionIds.add(optionId);
    } else {
      this.checkedOptionIds.delete(optionId);
    }
    this.cdr.detectChanges();
  }

  // 💾 5. Consolidar de golpe la nueva matriz transaccional en Aiven
  onSavePermissions(): void {
    if (!this.selectedRole) return;

    this.isSaving = true;
    this.successMessage = null;
    this.errorMessage = null;
    this.cdr.detectChanges();

    const payload = {
      roleId: this.selectedRole.id,
      menuOptionIds: Array.from(this.checkedOptionIds) // Convertimos el Set de vuelta a un Array JSON plano
    };

    this.http.post(`${environment.apiUrl}/security/permissions`, payload).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.successMessage = res?.message || 'Matriz de accesos blindada con éxito en la nube.';
        this.cdr.detectChanges();

        // Autolimpiamos el cartel flotante de éxito tras 4 segundos
        setTimeout(() => {
          this.successMessage = null;
          this.cdr.detectChanges();
        }, 4000);
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err?.error?.message || 'Error crítico en el cortafuegos de seguridad de Aiven.';
        this.cdr.detectChanges();
      }
    });
  }
}