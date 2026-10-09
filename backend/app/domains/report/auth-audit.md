  An audit of the Reports domain endpoints (report) was conducted against the system authorization rules in AUTHORIZATION_IMPLEMENTATION.md,        
  CATMS_API_Endpoints.md, and guide.md.                                                                                                             
  ──────                                                                                                                                            
  ## 1. Executive Summary & Validation Verdict                                                                                                      
                                                                                                                                                    
   Status          │ Component                           │ Evaluation
  ─────────────────┼─────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────
   Pass            │ Authentication Scheme               │ All endpoints enforce Bearer JWT authentication via deps.py:29-42 (401 Unauthorized on
                   │                                     │ missing/invalid token).
   Pass            │ RBAC Role Matrix                    │ Endpoint role permissions match the SRS / API specification (A, BM for management
                   │                                     │ analytics, A, BM, R for outstanding balances).
   Pass            │ Branch Manager Isolation            │ Branch Managers are strictly scoped to their assigned branch via router.py:15-28 (403
                   │                                     │ Forbidden if requesting another branch or if unassigned).
   Pass            │ Admin Cross-Branch Analytics        │ Admins retain unrestricted access to view system-wide aggregated metrics or filter by
                   │                                     │ specific branch.
   ⚠️ Discrepancy  │ Receptionist Scoping on Balances    │ Receptionists querying router.py:75-89 bypass router.py:15-28, enabling system-wide
                   │                                     │ access (privilege inversion vs. Branch Manager). Receptionists only require
                   │                                     │ outstanding balances for a specific patient (operational check-in/billing).
   ⚠️ Deficiency   │ Admin Filter on Treatment Frequency │ router.py:91-108 forces branch_id=None for Admins and does not accept branch_id as a
                   │                                     │ query parameter, even though the underlying service supports it.
   ⚠️ Outdated Doc │ AUTHORIZATION_IMPLEMENTATION.md     │ Lines 218–223 still list Reports under "Known scope and follow-up — endpoints not
                   │                                     │ currently implemented".
  ──────                                                                                                                                            
  ## 2. Endpoint-by-Endpoint Validation Matrix                                                                                                      
                                                                                                                                                    
  ### 1. GET /reports/appointments-summary (REQ: RG-1)                                                                                              
                                                                                                                                                    
  • Route Definition: router.py:39-55                                                                                                               
  • Allowed Roles: Admin, Branch Manager (Matches specification A, BM).                                                                             
  • Authentication: Enforced via Depends(require_role("Admin", "Branch Manager")).                                                                  
  • Branch Scoping:                                                                                                                                 
      • Admin: Can omit branch_id for national summary, or supply ?branch_id=X.                                                                     
      • Branch Manager: Forced to user.branch_id. Returns 403 if querying a different branch or if unassigned.                                      
  • Validation Result: VALID (Fully conforms to policy).                                                                                            
  ──────                                                                                                                                            
  ### 2. GET /reports/doctor-revenue (REQ: RG-2)                                                                                                    
                                                                                                                                                    
  • Route Definition: router.py:57-73                                                                                                               
  • Allowed Roles: Admin, Branch Manager (Matches specification A, BM).                                                                             
  • Authentication: Enforced via Depends(require_role("Admin", "Branch Manager")).                                                                  
  • Branch Scoping:                                                                                                                                 
      • Admin: Unrestricted (ranks across partitioned branches or single branch).                                                                   
      • Branch Manager: Strictly scoped to caller's branch.                                                                                         
  • Validation Result: VALID (Fully conforms to policy).                                                                                            
  ──────                                                                                                                                            
  ### 3. GET /reports/outstanding-balances (REQ: RG-3)                                                                                              
                                                                                                                                                    
  • Route Definition: router.py:75-89                                                                                                               
  • Allowed Roles: Admin, Branch Manager, Receptionist (Matches specification A, BM, R).                                                            
  • Authentication: Enforced via Depends(require_role("Admin", "Branch Manager", "Receptionist")).                                                  
  • Branch Scoping:                                                                                                                                 
    effective_branch_id = branch_id                                                                                                                 
    if _user.role == "Branch Manager":                                                                                                              
        effective_branch_id = _effective_branch_id(_user, branch_id)                                                                                
                                                                                                                                                    
  • Security & Scoping Analysis:                                                                                                                    
      • Branch Manager: Strictly scoped to user.branch_id (cannot view any other branch).
      • Receptionist: Only Branch Manager invokes router.py:15-28. If a Receptionist calls this endpoint without branch_id, they retrieve all
      outstanding balances across all branches nationwide. If they pass ?branch_id=2 (belonging to another branch), they inspect that branch's
      debtors.
      • Policy Conflict & Operational Realities: guide.md:35 notes "Receptionists may access outstanding balances independently of the Branch Manager scope"
      (to accommodate cross-branch walk-in billing settlements). However, in AUTHORIZATION_IMPLEMENTATION.md, cross-branch reads are restricted
      strictly to individual patient/emergency lookups (REQ-PM-2, SAFE-5, BR-5). Granting a Receptionist broader financial reporting visibility than a
      Branch Manager is a severe privilege inversion.
      • Patient-Level Operational Need: Receptionists require outstanding balance information exclusively about an individual patient (e.g. when checking
      in a patient or collecting payment for a walk-in). They have zero business requirement to pull aggregate lists of all clinic debtors.
      • Compliance Verdict: Enforcing that a Receptionist can only query outstanding balance for a specific patient is NOT a violation—it is a textbook
      application of the Principle of Least Privilege and directly adheres to AUTHORIZATION_IMPLEMENTATION.md.
• Validation Result: ⚠️ POLICY MISMATCH / SECURITY ANOMALY (Requires alignment).                                                                  
  ──────                                                                                                                                            
  ### 4. GET /reports/treatment-frequency (REQ: RG-4)                                                                                               
                                                                                                                                                    
  • Route Definition: router.py:91-108                                                                                                              
  • Allowed Roles: Admin, Branch Manager (Matches specification A, BM).                                                                             
  • Authentication: Enforced via Depends(require_role("Admin", "Branch Manager")).                                                                  
  • Branch Scoping:                                                                                                                                 
    data = await service.treatment_frequency(                                                                                                       
        conn,                                                                                                                                       
        branch_id=_effective_branch_id(user, None), # <--- branch_id query parameter missing!                                                       
        category=category,                                                                                                                          
        from_date=from_date,                                                                                                                        
        to_date=to_date,                                                                                                                            
    )                                                                                                                                               
                                                                                                                                                    
  • Security & Scoping Analysis:                                                                                                                    
      • For Branch Manager, passing None correctly forces user.branch_id.                                                                           
      • For Admin, passing None forces nationwide aggregate (branch_id = None). Admin cannot filter treatment frequency by a specific branch because
      branch_id is omitted from the route parameters, even though service.py:107-140 and test_report.py:67-80 already support branch filtering.     
  • Validation Result: ⚠️ DEFICIENT ROUTE PARAMETER (Admin capability restricted).                                                                  
  ──────                                                                                                                                            
  ### 5. GET /reports/insurance-vs-outofpocket (REQ: RG-5)                                                                                          
                                                                                                                                                    
  • Route Definition: router.py:110-126                                                                                                             
  • Allowed Roles: Admin, Branch Manager (Matches specification A, BM).                                                                             
  • Authentication: Enforced via Depends(require_role("Admin", "Branch Manager")).                                                                  
  • Branch Scoping:                                                                                                                                 
      • Admin: Unrestricted (can filter or view global summary).                                                                                    
      • Branch Manager: Strictly scoped to assigned branch.                                                                                         
  • Validation Result: VALID (Fully conforms to policy).                                                                                            
  ──────                                                                                                                                            
  ## 3. Required Changes                                                                                                                            
                                                                                                                                                    
  ### Change 1: Expose branch_id on treatment-frequency in router.py                                                                                
                                                                                                                                                    
  Allow Admins to filter treatment frequency by branch while preserving the Branch Manager restriction:                                             
                                                                                                                                                    
    # In app/domains/report/router.py                                                                                                               
    @router.get("/treatment-frequency")                                                                                                             
    async def treatment_frequency(                                                                                                                  
        conn: Annotated[PoolConnectionProxy, Depends(get_conn)],                                                                                    
        user: Annotated[UserIdentity, Depends(require_role("Admin", "Branch Manager"))],                                                            
        branch_id: Annotated[int | None, Query(gt=0)] = None,                                                                                       
        category: Annotated[str | None, Query(min_length=1, max_length=50)] = None,                                                                 
        from_date: Annotated[date | None, Query(alias="from")] = None,                                                                              
        to_date: Annotated[date | None, Query(alias="to")] = None,                                                                                  
    ) -> dict:                                                                                                                                      
        _validate_dates(from_date, to_date)                                                                                                         
        data = await service.treatment_frequency(                                                                                                   
            conn,                                                                                                                                   
            branch_id=_effective_branch_id(user, branch_id),                                                                                        
            category=category,                                                                                                                      
            from_date=from_date,                                                                                                                    
            to_date=to_date,                                                                                                                        
        )                                                                                                                                           
        return {"data": data, "error": None}                                                                                                        
  ──────                                                                                                                                            
  ### Change 2: Resolve Receptionist Scope on outstanding-balances                                                                                  
                                                                                                                                                    

Align the Receptionist access model with the Principle of Least Privilege and individual patient lookup requirements:

• Option A (Recommended — Enforce Patient-Scoped Query for Receptionists):
Receptionists only require balance information for a specific patient (e.g., cross-branch walk-ins or settlement). Enforce that Receptionists must provide a `patient_id` when querying cross-branch, or restrict them to their assigned branch if requesting a general list:
  # In app/domains/report/router.py
  @router.get("/outstanding-balances")
  async def outstanding_balances(
      conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
      user: Annotated[
          UserIdentity,
          Depends(require_role("Admin", "Branch Manager", "Receptionist")),
      ],
      branch_id: Annotated[int | None, Query(gt=0)] = None,
      patient_id: Annotated[int | None, Query(gt=0)] = None,
  ) -> dict:
      if user.role == "Branch Manager":
          effective_branch_id = _effective_branch_id(user, branch_id)
      elif user.role == "Receptionist":
          # If no patient specified, strictly constrain to Receptionist's assigned branch
          if patient_id is None and branch_id is not None and branch_id != user.branch_id:
              raise HTTPException(
                  status_code=status.HTTP_403_FORBIDDEN,
                  detail="Receptionist can only view outstanding balances for their assigned branch or for a specific patient",
              )
          effective_branch_id = user.branch_id if patient_id is None else branch_id
      else:
          effective_branch_id = branch_id

      data = await service.outstanding_balances(
          conn, branch_id=effective_branch_id, patient_id=patient_id
      )
      return {"data": data, "error": None}

• Option B (Enforce Strict Branch Isolation on Reports & Delegate Patient Balance to Billing):
Non-Admin roles should not have unrestricted visibility over all clinic branches. If a Receptionist requests outstanding balances from the Reports domain, scope them strictly to their assigned branch (identical to Branch Manager):
  # In app/domains/report/router.py
  def _effective_branch_id(user: UserIdentity, requested_branch_id: int | None) -> int | None:
      if user.role == "Admin":
          return requested_branch_id
      if user.branch_id is None:
          raise HTTPException(
              status_code=status.HTTP_403_FORBIDDEN,
              detail=f"{user.role} is not assigned to a branch",
          )
      if requested_branch_id is not None and requested_branch_id != user.branch_id:
          raise HTTPException(
              status_code=status.HTTP_403_FORBIDDEN,
              detail=f"{user.role} can only access their assigned branch",
          )
      return user.branch_id

  @router.get("/outstanding-balances")
  async def outstanding_balances(
      conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
      user: Annotated[
          UserIdentity,
          Depends(require_role("Admin", "Branch Manager", "Receptionist")),
      ],
      branch_id: Annotated[int | None, Query(gt=0)] = None,
  ) -> dict:
      data = await service.outstanding_balances(
          conn, branch_id=_effective_branch_id(user, branch_id)
      )
      return {"data": data, "error": None}

  Note: For cross-branch walk-in billing settlements, Receptionists already have access to the operational billing endpoint `GET /invoices?patient_id=X` (app/domains/billing/router.py:31-38), which queries `v_invoice_outstanding` without leaking the entire debtor roster of another branch.

• Option C (Strict Patient Requirement for Receptionists):
Require that if `user.role == "Receptionist"`, `patient_id` MUST be provided (returns 422 or 403 if missing). This explicitly enforces that Receptionists use this endpoint only for patient-specific lookups and never for aggregate branch reports.

──────                                                                                                                                            
  ### Change 3: Update AUTHORIZATION_IMPLEMENTATION.md                                                                                              
                                                                                                                                                    
  1. Remove reports from Section "Known scope and follow-up" (AUTHORIZATION_IMPLEMENTATION.md:218-223):                                             
      • Before: "The endpoint markdown lists report and appointment reschedule endpoints that are not currently implemented in app/domains."        
      • After: Keep only appointment reschedule in follow-up.                                                                                       
  2. Add a new section "### Reports authorization":                                                                                                 
      • Document RBAC rules: Admin and Branch Manager for RG-1, RG-2, RG-4, RG-5; Admin, Branch Manager, and Receptionist for RG-3.                 
      • Document branch isolation for analytics: Branch Manager is bound to user.branch_id (403 on mismatch). Admins retain cross-branch querying.  
      • Explicitly document the decided Receptionist policy for GET /reports/outstanding-balances.                                                  
  3. Add test_report.py to Section "Tests added or updated".                                                                                        
  ──────                                                                                                                                            
  ### Change 4: Add Route-Level RBAC Tests in test_report.py                                                                                        
                                                                                                                                                    
  Existing tests in test_report.py only test the helper _effective_branch_id and service queries. Add router-level unit tests verifying:            

Resume with -c (or command below):
agy --conversation=ba1d88de-0b0c-45ca-8062-604f2dc3a1b4

                                                                                                                                                    
  • Doctor role receives 403 Forbidden across all report routes.                                                                                    
  • Receptionist role receives 403 Forbidden on appointments-summary, doctor-revenue, treatment-frequency, and insurance-vs-outofpocket.            
  • Receptionist behavior on outstanding-balances.                                                                                                  
  • Admin filtering vs. Branch Manager forced branch scope.                                                                                         
  • Invalid date range (from > to) returns 422 Unprocessable Entity. 