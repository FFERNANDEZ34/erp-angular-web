import {
  Component,
  OnInit,
  inject,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MenuService, MenuNode } from '../../../core/services/menu.service';

export interface CompanySubscription {
  id: number;
  name: string;
}
export interface BranchOffice {
  id: number;
  name: string;
}

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export class LayoutComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private menuService = inject(MenuService);
  private cdr = inject(ChangeDetectorRef);
  // Estados de control de interfaces de usuario
  isUserDropdownOpen = false;
  isProfileDropdownOpen = false;
  isDarkModeActive = false;
  isSidebarCollapsed = false;

  // Árbol recursivo e información de cuenta
  menuTree: MenuNode[] = [];
  renderMenu = true;

  //currentUser = { name: 'Usuario', email: '', role: '' };
  currentUser = { name: 'Usuario', email: '', role: '' };

  // Colecciones reactivas para los combos (*ngFor)
  companiesList: CompanySubscription[] = [];
  branchesList: BranchOffice[] = [];
  profilesList: string[] = [];

  // Contextos activos seleccionados
  selectedCompanyId: number = 0;
  selectedBranchId: number = 0;
  selectedProfileRole: string = '';

  expandedMenus: Record<number, boolean> = {};
  expandedSubMenus: Record<number, boolean> = {};

  ngOnInit(): void {
    this.checkThemeMode();
    this.extractSecurityMatrix();
  }

  private checkThemeMode(): void {
    if (localStorage.getItem('theme') === 'dark') {
      this.isDarkModeActive = true;
      document.body.classList.add('dark-theme-mode');
    }
  }

  // 🔎 EXTRACCIÓN DEFENSIVA DE LA MATRIZ DEL JWT
  private extractSecurityMatrix(): void {
    const tokenData = this.authService.getUserDataFromToken();

    if (!tokenData) {
      this.onSignOut();
      return;
    }

    this.currentUser.email = tokenData.email || '';

    // ✅ CORRECCIÓN TS: Tomamos solo la primera posición del split [0] para que devuelva un string plano
    this.currentUser.name = this.currentUser.email.split('@')[0];

    const permissions = tokenData.permissions || {};
    this.companiesList = [];

    Object.keys(permissions).forEach((compKey) => {
      const companyId = parseInt(compKey.replace('comp_', ''));
      if (!isNaN(companyId)) {
        this.companiesList.push({
          id: companyId,
          name: permissions[compKey].name || `Empresa Comercial ${companyId}`,
        });
      }
    });

    const activeCtx = tokenData.activeContext;

    if (activeCtx && activeCtx.companyId) {
      this.selectedCompanyId = Number(activeCtx.companyId);
      this.selectedBranchId = Number(activeCtx.branchId);
      this.selectedProfileRole = activeCtx.role;
      this.currentUser.role = activeCtx.role.toUpperCase();

      this.authService.activeCompanyId$.next(this.selectedCompanyId);
      this.authService.activeBranchId$.next(this.selectedBranchId);
      this.authService.activeProfile$.next(this.selectedProfileRole);
      this.authService.setContext(
        this.selectedCompanyId,
        this.selectedBranchId,
      );

      this.rebuildContextOptions(permissions, this.selectedCompanyId, false);

      this.loadDynamicMenu();
    } else if (this.companiesList.length > 0) {
      this.selectedCompanyId = this.companiesList[0].id; // Ajustado a la primera posición del array de forma segura
      this.rebuildContextOptions(permissions, this.selectedCompanyId, true);
    }

    // ✅ ¡ERROR ELIMINADO! Al estar declarado el inject arriba, ya compilará perfectamente
    this.cdr.detectChanges();
  }

  // 🔀 RECONSTRUCCIÓN EN CASCADA COMPACTA
  private rebuildContextOptions(
    permissions: any,
    companyId: number,
    isInitial = false,
  ): void {
    const compKey = `comp_${companyId}`;
    const companyData = permissions[compKey] || { branches: {} };
    const branchesMap = companyData.branches || {};

    this.branchesList = [];
    Object.keys(branchesMap).forEach((branchKey) => {
      const branchId = parseInt(branchKey.replace('branch_', ''));
      if (!isNaN(branchId)) {
        this.branchesList.push({
          id: branchId,
          name: branchesMap[branchKey].name || `Sede S-${branchId}`,
        });
      }
    });

    if (this.branchesList.length > 0) {
      if (isInitial) {
        this.selectedBranchId = this.branchesList[0].id;
      } else {
        const exists = this.branchesList.some(
          (b) => b.id === this.selectedBranchId,
        );
        if (!exists) this.selectedBranchId = this.branchesList[0].id;
      }

      const branchKey = `branch_${this.selectedBranchId}`;
      this.profilesList = branchesMap[branchKey]?.roles || [];

      if (this.profilesList.length > 0) {
        const roleExists = this.profilesList.includes(this.selectedProfileRole);
        this.selectedProfileRole = roleExists
          ? this.selectedProfileRole
          : this.profilesList[0];
        this.currentUser.role = this.selectedProfileRole.toUpperCase();
      }
    }

    if (isInitial) {
      this.authService.setContext(
        this.selectedCompanyId,
        this.selectedBranchId,
      );
      this.loadDynamicMenu();
    }
  }

  loadDynamicMenu(): void {
    // Apagamos el menú un microsegundo por el ciclo de detección de Angular
    this.renderMenu = false;

    this.menuService.getSidebarMenu().subscribe({
      next: (res) => {
        this.menuTree = res?.data || [];

        // Volvemos a encender el bloque obligando a Angular a dibujar el *ngFor desde cero
        setTimeout(() => {
          this.renderMenu = true;
          console.log(
            '🔄 Renderizado físico del Sidebar forzado con éxito absoluto.',
          );
        }, 50);
      },
      error: (err) => {
        console.error('Error cargando el menú desde el endpoint sidebar:', err);
        this.renderMenu = true;
      },
    });
  }

  onCompanyChange(companyId: number): void {
    this.selectedCompanyId = companyId;
    const permissions =
      this.authService.getUserDataFromToken()?.permissions || {};

    const compKey = `comp_${companyId}`;
    const companyData = permissions[compKey] || { branches: {} };
    const branchesMap = companyData.branches || {};
    const availableBranchIds = Object.keys(branchesMap).map((key) =>
      parseInt(key.replace('branch_', '')),
    );

    if (availableBranchIds.length > 0) {
      this.selectedBranchId = availableBranchIds[0];
      const branchKey = `branch_${this.selectedBranchId}`;
      this.profilesList = branchesMap[branchKey]?.roles || [];
      this.selectedProfileRole =
        this.profilesList.length > 0 ? this.profilesList[0] : '';
    }

    this.rebuildContextOptions(permissions, companyId, false);
    this.executeTokenSwitch();
  }

  onBranchChange(branchId: number): void {
    this.selectedBranchId = branchId;

    // 🔬 CORRECCIÓN: Eliminamos el método inexistente y usamos únicamente getUserDataFromToken()
    const tokenData = this.authService.getUserDataFromToken();
    const permissions = tokenData?.permissions || {};

    const compKey = `comp_${this.selectedCompanyId}`;
    const branchKey = `branch_${branchId}`;

    // Extraemos los roles asociados de forma segura
    const companyData = permissions[compKey] || { branches: {} };
    const branchData = companyData.branches?.[branchKey] || { roles: [] };
    this.profilesList = branchData.roles || [];

    if (this.profilesList.length > 0) {
      this.selectedProfileRole = this.profilesList[0];
      this.currentUser.role = this.selectedProfileRole.toUpperCase();
    }

    this.executeTokenSwitch();
  }

  onProfileChange(roleName: string): void {
    this.selectedProfileRole = roleName;
    this.currentUser.role = roleName.toUpperCase();
    this.isProfileDropdownOpen = false;
    this.executeTokenSwitch();
  }

  private executeTokenSwitch(): void {
    // 1. Seteamos los valores reactivos en caliente para el interceptor
    this.authService.setContext(this.selectedCompanyId, this.selectedBranchId);

    // 2. Disparamos la conmutación hacia Express
    this.authService
      .switchContext(
        this.selectedCompanyId,
        this.selectedBranchId,
        this.selectedProfileRole,
      )
      .subscribe({
        next: (res: any) => {
          const nuevoToken = res?.data?.accessToken || res?.accessToken;
          if (nuevoToken) {
            localStorage.setItem('accessToken', nuevoToken); // Guardamos el JWT fresco actualizado

            // Sincronizamos las variables globales en caliente
            this.authService.activeCompanyId$.next(this.selectedCompanyId);
            this.authService.activeBranchId$.next(this.selectedBranchId);
            this.authService.activeProfile$.next(this.selectedProfileRole);
          }

          console.log('✅ Contexto multi-tenant refrescado con éxito.');
          this.loadDynamicMenu(); // Recarga el Sidebar de forma limpia
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error(
            '💥 Error crítico: La sesión ha expirado o el token es inválido.',
            err,
          );

          // 🚨 CONTROL DE CONTINGENCIA ABSOLUTO CONTRA TOKENS MUERTOS:
          // Si la sesión caducó, el backend rebotará con un 401 o 403.
          // En lugar de dejar la pantalla congelada, limpiamos las variables y botamos al login de forma elegante.
          //this.formErrorMessage =
          //  'Su sesión transaccional ha caducado. Reingrese al sistema.';

          // Ejecutamos el cierre de sesión físico del búnker
          this.onSignOut();
        },
      });
  }

  private setupGodMode(): void {
    this.companiesList = [{ id: 1, name: 'Holding Principal Maestro' }];
    this.branchesList = [{ id: 1, name: 'Sede Central General' }];
    this.profilesList = ['super-admin'];
    this.selectedCompanyId = 1;
    this.selectedBranchId = 1;
    this.selectedProfileRole = 'super-admin';
    this.currentUser.role = 'SUPER-ADMIN';
    this.authService.setContext(1, 1);
    this.loadDynamicMenu();
  }

  toggleSidebar(event: Event): void {
    event.stopPropagation();
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }
  toggleDarkMode(): void {
    this.isDarkModeActive = !this.isDarkModeActive;
    if (this.isDarkModeActive) {
      document.body.classList.add('dark-theme-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme-mode');
      localStorage.setItem('theme', 'light');
    }
  }
  toggleMenuExpand(menuId: number, event: Event): void {
    event.stopPropagation();
    if (this.isSidebarCollapsed) this.isSidebarCollapsed = false;
    this.expandedMenus[menuId] = !this.expandedMenus[menuId];
  }
  isMenuExpanded(menuId: number): boolean {
    return !!this.expandedMenus[menuId];
  }
  toggleSubMenuExpand(subMenuId: number, event: Event): void {
    event.stopPropagation();
    this.expandedSubMenus[subMenuId] = !this.expandedSubMenus[subMenuId];
  }
  isSubMenuExpanded(subMenuId: number): boolean {
    return !!this.expandedSubMenus[subMenuId];
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown-click')) {
      this.isUserDropdownOpen = false;
      this.isProfileDropdownOpen = false;
    }
  }

  onSignOut(): void {
    this.authService.clearSession();
    document.body.classList.remove('dark-theme-mode');
    this.router.navigate(['/auth/login']);
  }
}
