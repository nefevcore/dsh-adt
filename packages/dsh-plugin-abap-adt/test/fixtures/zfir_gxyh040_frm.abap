*&---------------------------------------------------------------------*
*& 包含               ZFIR_GXYH040_FRM
*&---------------------------------------------------------------------*
*&---------------------------------------------------------------------*
*& Form frm_main
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
FORM frm_main .

  PERFORM frm_auth_check.
  PERFORM frm_get_data.

  IF sy-batch <> abap_true.
    PERFORM frm_display TABLES gt_data.
  ENDIF.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_get_data
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
FORM frm_get_data .

  CLEAR gt_data.
  CASE abap_true.
    WHEN r_sub.
      PERFORM frm_get_archive_data.
    WHEN r_par OR r_cov.
      PERFORM frm_get_volume_data.
  ENDCASE.
*  SORT gt_data BY zmm_no zzm_no. " SHYY_ABAP04_26.02.2026 11:26:24
  SORT gt_data BY zmm_no zitemno zzm_no. " SHYY_ABAP04_26.02.2026 11:26:27

  PERFORM frm_fetch_text.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_fetch_text
*&---------------------------------------------------------------------*
*& 获取描述
*&---------------------------------------------------------------------*
FORM frm_fetch_text .

  " &1 - 文本源
  " &2 - 键值
  " &3 - 文本值
  DEFINE _def_fetch_text.
    READ TABLE &1 REFERENCE INTO DATA(lr_&2_) WITH KEY code = lr_data->&2 BINARY SEARCH.
    IF sy-subrc = 0.
      lr_data->&3 = lr_&2_->value.
    ENDIF.
  END-OF-DEFINITION.

  " 利润中心文本
  WITH +ds AS ( SELECT prctr FROM @gt_data AS ds WHERE prctr IS NOT INITIAL GROUP BY prctr )
  SELECT
    cepct~prctr AS code,
    cepct~ltext AS value
    FROM +ds
    INNER JOIN cepct
       ON cepct~spras = '1'
      AND +ds~prctr = cepct~prctr
      AND cepct~datbi = '99991231'
    INTO TABLE @DATA(lt_cepct).
  SORT lt_cepct BY code.

  " 母码状态
  SELECT domvalue_l AS code, ddtext AS value
    FROM dd07t
    WHERE domname = 'ZSSFD_STATUS_3'
      AND ddlanguage = '1'
    INTO TABLE @DATA(lt_volume_state_text).
  SORT lt_volume_state_text BY code.

  " 子码状态
  SELECT domvalue_l AS code, ddtext AS value
    FROM dd07t
    WHERE domname = 'ZSSFD_STATUS_2'
      AND ddlanguage = '1'
    INTO TABLE @DATA(lt_archive_state_text).
  SORT lt_archive_state_text BY code.

*&&--------Begin of Mod: S/4 SHYY_ABAP04_19.01.2026 10:55:01
  " 附件类型描述
  SELECT
    domvalue_l AS code,
    ddtext AS value
    FROM dd07t
    WHERE domname = 'ZSSFD_FJLX'
      AND ddlanguage = '1'
    INTO TABLE @DATA(lt_zfjlx).
  SORT lt_zfjlx BY value.
*&&--------End of Mod: S/4 SHYY_ABAP04_19.01.2026 10:55:01

  " 读取文本值
  LOOP AT gt_data REFERENCE INTO DATA(lr_data).
    _def_fetch_text lt_cepct prctr prctr_text.
    _def_fetch_text lt_volume_state_text zzt zzt_text.
    _def_fetch_text lt_archive_state_text zzt_sub zzt_sub_text.
    _def_fetch_text lt_zfjlx zfjlx zfjlx_text. " SHYY_ABAP04_19.01.2026 10:59:31
  ENDLOOP.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_display
*&---------------------------------------------------------------------*
*& ALV展示
*&---------------------------------------------------------------------*
FORM frm_display TABLES ct_data TYPE STANDARD TABLE.

  DATA ls_layout TYPE lvc_s_layo.
  DATA lt_fieldcat TYPE STANDARD TABLE OF lvc_s_fcat.

  PERFORM frm_set_layout CHANGING ls_layout.
  PERFORM frm_set_fieldcat TABLES lt_fieldcat.
  PERFORM frm_set_style.
  PERFORM frm_set_color.

  CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY_LVC'
    EXPORTING
      i_callback_program       = sy-repid
      i_callback_pf_status_set = 'FRM_PF_STATUS'
      i_callback_user_command  = 'FRM_USER_COMMAND'
      is_layout_lvc            = ls_layout
      it_fieldcat_lvc          = lt_fieldcat
      i_default                = abap_true
      i_save                   = 'A'
    TABLES
      t_outtab                 = ct_data[]
    EXCEPTIONS
      program_error            = 1
      OTHERS                   = 2.
  IF sy-subrc <> 0.
    MESSAGE ID sy-msgid TYPE sy-msgty NUMBER sy-msgno
    WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ENDIF.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_set_layout
*&---------------------------------------------------------------------*
*& 报表布局设置
*&---------------------------------------------------------------------*
FORM frm_set_layout CHANGING cs_layout TYPE lvc_s_layo.

  CLEAR cs_layout.
  cs_layout-zebra = abap_true. " 斑马线
  cs_layout-cwidth_opt = abap_true. " 自动调整ALV列宽
  cs_layout-sel_mode = 'A'. " 选择模式
  cs_layout-info_fname = 'RCOL'. " 行颜色设置
  cs_layout-ctab_fname = 'T_SCOL'. " 单元格颜色设置
  cs_layout-stylefname = 'T_STYL'. " 单元格控制

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_set_fieldcat
*&---------------------------------------------------------------------*
*& 字段目录设置
*&---------------------------------------------------------------------*
FORM frm_set_fieldcat TABLES ct_fieldcat TYPE lvc_t_fcat.

  DATA ls_fieldcat TYPE lvc_s_fcat.

  DEFINE _init_fieldcat.
    CLEAR ls_fieldcat.
    ls_fieldcat-fieldname = &1.
    ls_fieldcat-scrtext_s =
    ls_fieldcat-scrtext_m =
    ls_fieldcat-scrtext_l =
    ls_fieldcat-tooltip =
    ls_fieldcat-coltext =
    ls_fieldcat-seltext = &2.
    ls_fieldcat-ref_table = &3.
    ls_fieldcat-ref_field = &4.
    INSERT ls_fieldcat INTO TABLE ct_fieldcat.
  END-OF-DEFINITION.


  _init_fieldcat 'BUKRS  ' '公司代码' 'ZFIT_YSFJ_0003' 'BUKRS  '.
  _init_fieldcat 'GJAHR  ' '年度' 'ZFIT_YSFJ_0003' 'GJAHR  '.
  _init_fieldcat 'POPER  ' '期间' 'ZFIT_YSFJ_0003' 'POPER  '.
  _init_fieldcat 'PRCTR' '利润中心' 'ZFIT_YSFJ_0003' 'PRCTR'.
  _init_fieldcat 'PRCTR_TEXT' '利润中心名称' 'ZFIT_YSFJ_0003' 'PRCTR_TEXT'.
  _init_fieldcat 'ZMM_NO ' '母码编号' 'ZFIT_YSFJ_0003' 'ZMM_NO '.
  _init_fieldcat 'ZITEMNO' '二级编号' 'ZFIT_YSFJ_0003' 'ZITEMNO'.
  _init_fieldcat 'ZMMMS  ' '母码描述' 'ZFIT_YSFJ_0003' 'ZMMMS  '.
  IF r_sub = abap_true.
    _init_fieldcat 'ZZM_NO ' '子码编号' 'ZFIT_YSFJ_0002' 'ZZM_NO '.
  ENDIF.

  CASE abap_true.
    WHEN r_par OR r_cov.
      _init_fieldcat 'ZHH  ' '盒号' 'ZFIT_YSFJ_0003' 'ZHH    '.
      _init_fieldcat 'ZJH  ' '架号' 'ZFIT_YSFJ_0003' 'ZJH    '.
      _init_fieldcat 'ZFCH ' '分册号' 'ZFIT_YSFJ_0003' 'ZFCH   '.
      _init_fieldcat 'ZGH  ' '柜号' 'ZFIT_YSFJ_0003' 'ZGH    '.
      _init_fieldcat 'ZWLWZ' '物理位置' 'ZFIT_YSFJ_0003' 'ZWLWZ  '.
      _init_fieldcat 'ZZT  ' '母码状态' 'ZFIT_YSFJ_0003' 'ZZT    '.
      _init_fieldcat 'ZZT_TEXT' '母码状态描述' '' ''.
      _init_fieldcat 'ZDAT ' '母码创建日期' 'ZFIT_YSFJ_0003' 'ZDAT   '.
      _init_fieldcat 'ZERP_CODE' '档案员' 'ZFIT_YSFJ_0003' 'ZERP_CODE'.
      _init_fieldcat 'ZERP_NAME' '档案员名称' 'ZFIT_YSFJ_0003' 'ZERP_NAME'.

    WHEN r_sub.
      _init_fieldcat 'ZFJYWS' '附件已完善' 'ZFIT_YSFJ_0002' 'ZFJYWS'.
      _init_fieldcat 'ZZT_SUB' '子码状态' 'ZFIT_YSFJ_0002' 'ZZT'.
      _init_fieldcat 'ZZT_SUB_TEXT' '子码状态描述' '' ''.
*&&--------Begin of Mod: S/4 SHYY_ABAP04_19.01.2026 10:51:52
      _init_fieldcat 'OBJTYPE' '单据类型' 'ZFIT_YSFJ_0002' 'OBJTYPE'.
      _init_fieldcat 'OBJKEY' '单据编号' 'ZFIT_YSFJ_0002' 'OBJKEY'.
      _init_fieldcat 'BELNR' '凭证编号' 'ZFIT_YSFJ_0002' 'BELNR'.
      _init_fieldcat 'BUDAT' '过账日期' 'ZFIT_YSFJ_0002' 'BUDAT'.
      _init_fieldcat 'ZBZ' '备注' 'ZFIT_YSFJ_0002' 'ZBZ'.
      _init_fieldcat 'ZFJLX' '附件类型' 'ZWF_OBJECT' 'ZFJLX'.
      _init_fieldcat 'ZFJLX_TEXT' '附件类型描述' 'ZWF_OBJECT' 'ZFJLX_TEXT'.
*&&--------End of Mod: S/4 SHYY_ABAP04_19.01.2026 10:51:52

    WHEN OTHERS.
  ENDCASE.

*  _init_fieldcat 'ZSEL' '选择项' '' ''.
*  _init_fieldcat 'MTYPE' '处理状态' '' ''.
*  _init_fieldcat 'MSG' '处理消息' '' ''.

  " 个性化自己输出数据格式
  LOOP AT ct_fieldcat REFERENCE INTO DATA(lr_fieldcat).
    IF lr_fieldcat->fieldname = 'ZSEL'.
      lr_fieldcat->checkbox = abap_true.
      lr_fieldcat->edit = abap_true.
    ENDIF.
  ENDLOOP.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_set_style
*&---------------------------------------------------------------------*
*& 字段样式设置
*&---------------------------------------------------------------------*
FORM frm_set_style.

  DATA ls_styl TYPE lvc_s_styl.

  LOOP AT gt_data REFERENCE INTO DATA(lr_data).
    CLEAR lr_data->t_styl.

    " 设置ALV字段或行的状态
    " 常用有禁止编辑CL_GUI_ALV_GRID=>MC_STYLE_DISABLED
    " 禁止删除行CL_GUI_ALV_GRID=>MC_STYLE_NO_DELETE_ROW

  ENDLOOP.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_set_color
*&---------------------------------------------------------------------*
*& 字段颜色设置
*&---------------------------------------------------------------------*
FORM frm_set_color.

  STATICS:
    BEGIN OF color,
      r_light   TYPE char04,
      r_success TYPE char04,
      r_error   TYPE char04,
      light     TYPE lvc_s_scol-color,
      success   TYPE lvc_s_scol-color,
      error     TYPE lvc_s_scol-color,
    END OF color.
  IF color IS INITIAL.
    color-r_light = 'C300'.
    color-r_success = 'C500'.
    color-r_error = 'C600'.
    color-light = VALUE #( col = 3 ).
    color-success = VALUE #( col = 5 ).
    color-error = VALUE #( col = 6 ).
  ENDIF.

  DATA ls_scol TYPE lvc_s_scol.

  LOOP AT gt_data REFERENCE INTO DATA(lr_data).
    CLEAR lr_data->t_scol.

    IF lr_data->zsel = abap_true.
      lr_data->rcol = color-r_light.
    ENDIF.

    IF lr_data->mtype = 'E'.
      lr_data->t_scol = VALUE #( BASE lr_data->t_scol color = color-error
                                 ( fname = 'MTYPE' )
                                 ( fname = 'MSG' )
      ).
    ENDIF.
  ENDLOOP.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_pf_status
*&---------------------------------------------------------------------*
*& 设置GUI状态
*&---------------------------------------------------------------------*
FORM frm_pf_status USING ct_extab TYPE slis_t_extab.

  DATA lv_title TYPE string.
  lv_title = '子码母码实时打印'.
  CASE abap_true.
    WHEN r_par.
      lv_title = '母码实时打印'.
    WHEN r_sub.
      lv_title = '子码实时打印'.
    WHEN r_cov.
      lv_title = '封面目录打印'.
  ENDCASE.

  " 先全删，再逐个放出
  ct_extab = VALUE #(
    ( fcode = 'CR_VOLUME ' ) " 创建母码
    ( fcode = 'DE_VOLUME ' ) " 删除母码 " SHYY_ABAP04_01.06.2026 10:27:56
    ( fcode = 'CR_VOL_SUB' ) " 创建母码二级编号
    ( fcode = 'CR_ARCHIVE' ) " 创建子码
    ( fcode = 'ZPRINT_SUB' ) " 打印子码
    ( fcode = 'ZPRINT_SUB' ) " 打印子码
    ( fcode = 'ZPRINT_PAR' ) " 打印母码
    ( fcode = 'ZPRINT_COV' ) " 打印移交目录
*&&--------Begin of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL
    ( fcode = 'ZEXPORT_VOL' ) " 导出母码信息EXCEL
*&&--------End of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL
  ).

  CASE abap_true.
    WHEN r_par.
      DELETE ct_extab WHERE fcode = 'CR_VOLUME '.
      DELETE ct_extab WHERE fcode = 'DE_VOLUME '. " SHYY_ABAP04_01.06.2026 10:28:01
      DELETE ct_extab WHERE fcode = 'CR_VOL_SUB'.
*&&--------Begin of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL
      " 母码页签放出导出按钮
      DELETE ct_extab WHERE fcode = 'ZEXPORT_VOL'.
*&&--------End of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL
      DELETE ct_extab WHERE fcode = 'ZPRINT_PAR'.
    WHEN r_sub.
      DELETE ct_extab WHERE fcode = 'CR_ARCHIVE'.
      DELETE ct_extab WHERE fcode = 'ZPRINT_SUB'.
    WHEN r_cov.
      DELETE ct_extab WHERE fcode = 'ZPRINT_COV'.
  ENDCASE.

  CASE abap_true.
    WHEN p_crtvol.
      SET PF-STATUS 'PF_VOLUME' EXCLUDING ct_extab.
    WHEN p_crtarc.
      SET PF-STATUS 'PF_ARCHIVE' EXCLUDING ct_extab.
    WHEN OTHERS.
      SET PF-STATUS 'STATUS' EXCLUDING ct_extab.
      SET TITLEBAR 'TITLE' WITH lv_title.
  ENDCASE.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_user_command
*&---------------------------------------------------------------------*
*& 功能响应
*&---------------------------------------------------------------------*
FORM frm_user_command USING cv_ucomm LIKE sy-ucomm
                            cs_selfield TYPE slis_selfield.

  IF p_crtvol = abap_true OR p_crtarc = abap_true.
    PERFORM frm_selscr_pai.
    RETURN.
  ENDIF.

  " 刷新屏幕数据到内表
  DATA: lo_grid TYPE REF TO cl_gui_alv_grid.
  CALL FUNCTION 'GET_GLOBALS_FROM_SLVC_FULLSCR'
    IMPORTING
      e_grid = lo_grid.
  CALL METHOD lo_grid->check_changed_data.

  PERFORM frm_get_data_selection.

  " 按钮功能实现
  CASE cv_ucomm.
    WHEN '&IC1'. " 双击
    WHEN 'CR_VOLUME'.
      PERFORM frm_popup_create_volume.
*&&--------Begin of Mod: S/4 SHYY_ABAP04_01.06.2026 10:28:12
    WHEN 'DE_VOLUME'.
      PERFORM frm_popup_delete_volume.
*&&--------End of Mod: S/4 SHYY_ABAP04_01.06.2026 10:28:12
    WHEN 'CR_VOL_SUB'.
      PERFORM frm_create_volume_itemno.
    WHEN 'CR_ARCHIVE'.
      PERFORM frm_popup_create_archive.
    WHEN 'ZPRINT_SUB'.
      PERFORM frm_print_sub_code.
    WHEN 'ZPRINT_PAR'.
      PERFORM frm_print_parent_code.
    WHEN 'ZPRINT_COV'.
*      PERFORM frm_print_cover.
      PERFORM frm_print_cover_pdf.
*&&--------Begin of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL
    WHEN 'ZEXPORT_VOL'.
      PERFORM frm_export_volume_excel.
*&&--------End of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL
    WHEN OTHERS.
  ENDCASE.

  PERFORM frm_reset_data_selection.

  " 刷新ALV 显示值
  cs_selfield-refresh = abap_true .
  cs_selfield-row_stable = abap_true .
  cs_selfield-col_stable = abap_true .

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_get_data_selection
*&---------------------------------------------------------------------*
*& 将侧边栏选择也传递到ZSEL字段上
*&---------------------------------------------------------------------*
FORM frm_get_data_selection.

  " 刷新屏幕数据到内表
  DATA: lo_grid TYPE REF TO cl_gui_alv_grid.
  CALL FUNCTION 'GET_GLOBALS_FROM_SLVC_FULLSCR'
    IMPORTING
      e_grid = lo_grid.

  " 获取ALV选取行
  DATA lt_rows TYPE lvc_t_row.
  CALL METHOD lo_grid->get_selected_rows
    IMPORTING
      et_index_rows = lt_rows.

  " 获取已过滤行
  DATA lt_filter TYPE lvc_t_fidx.
  CALL METHOD lo_grid->get_filtered_entries
    IMPORTING
      et_filtered_entries = lt_filter.

  LOOP AT lt_rows INTO DATA(ls_row).
    READ TABLE lt_filter TRANSPORTING NO FIELDS WITH KEY table_line = ls_row-index.
    IF sy-subrc = 0.
      CONTINUE.
    ENDIF.
    READ TABLE gt_data REFERENCE INTO DATA(lr_data) INDEX ls_row-index.
    IF sy-subrc = 0.
      lr_data->zsel = abap_true.
    ENDIF.
  ENDLOOP.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_reset_data_selection
*&---------------------------------------------------------------------*
*& 重置勾选项
*&---------------------------------------------------------------------*
FORM frm_reset_data_selection.

  DATA: lo_grid TYPE REF TO cl_gui_alv_grid.
  CALL FUNCTION 'GET_GLOBALS_FROM_SLVC_FULLSCR'
    IMPORTING
      e_grid = lo_grid.

  " 获取已过滤行
  DATA lt_filter TYPE lvc_t_fidx.
  CALL METHOD lo_grid->get_filtered_entries
    IMPORTING
      et_filtered_entries = lt_filter.

  LOOP AT gt_data REFERENCE INTO DATA(lr_data).
    READ TABLE lt_filter TRANSPORTING NO FIELDS WITH KEY table_line = sy-tabix.
    IF sy-subrc = 0.
      CONTINUE.
    ENDIF.
    CLEAR lr_data->zsel.
  ENDLOOP.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_print_sub_code
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_print_sub_code .

  DATA lv_qrcode_data TYPE char255.
  DATA lv_qrcode_name TYPE tdobname.
  DATA lv_qrcode_text TYPE char255.

  DATA:
*    lv_formname      TYPE tdsfname VALUE 'ZFSSC_PF_QRCODE', " Smartforms名称
    lv_formname      TYPE tdsfname VALUE 'ZFFI_GXYH040_QRCODE', " Smartforms名称
    lv_fm_name       TYPE rs38l_fnam,    " 函数模块名称
    ls_control_param TYPE ssfctrlop,     " 控制参数
    ls_output_param  TYPE ssfcompop,     " 输出参数
    ls_job_param     TYPE ssfcrescl.     " 输出参数

  CALL FUNCTION 'SSF_FUNCTION_MODULE_NAME'
    EXPORTING
      formname = lv_formname
    IMPORTING
      fm_name  = lv_fm_name.

  " 控制参数设置
*  ls_control_param-no_dialog = 'X'.        " 无对话框
  ls_control_param-no_open   = 'X'.        "
  ls_control_param-no_close  = 'X'.        "
  ls_control_param-preview   = 'X'.        " 非预览模式
  ls_control_param-langu     = '1'.        " 语言

  " 设置输出参数
*  ls_output_param-tddest  = p_prntr.       " 打印机
  ls_output_param-tdimmed = 'X'.           " 立即打印
  ls_output_param-tddelete = 'X'.          " 打印后删除假脱机

  CALL FUNCTION 'SSF_OPEN'
    EXPORTING
      control_parameters = ls_control_param
      output_options     = ls_output_param
    EXCEPTIONS
      formatting_error   = 1
      internal_error     = 2
      send_error         = 3
      user_canceled      = 4
      OTHERS             = 5.
  IF sy-subrc <> 0.
    MESSAGE ID sy-msgid TYPE 'E' NUMBER sy-msgno
            WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ENDIF.

  DATA(lt_data) = gt_data.
  DELETE lt_data WHERE zsel <> abap_true.
  SORT lt_data BY zzm_no gjahr.
  DELETE lt_data WHERE zzm_no IS INITIAL.

  DATA(lo_progress) = NEW lcl_progress( ).
  lo_progress->start( total = lines( lt_data ) ).
  " 进度条比较耗性能，可以通过设置时间间隔，控制刷新频率
  lo_progress->m_interval = 1.

  LOOP AT lt_data REFERENCE INTO DATA(lr_data) WHERE zsel = abap_true.
    lo_progress->next( ).

    DATA ls_info TYPE zcl_zssf_archive=>ty_sub_code_info.
    CLEAR ls_info.
    ls_info-zzm_no = lr_data->zzm_no.
    ls_info-bukrs = lr_data->bukrs.
    ls_info-gjahr = lr_data->gjahr.

    lv_qrcode_data = zcl_zssf_http_interface=>generate_intf_url_get_sub_code( iv_sub_code_info = ls_info ).
    lv_qrcode_name = |{ lr_data->zzm_no }{ lr_data->gjahr }|.

    CALL FUNCTION 'ZFM_MM_QRCODE_TO_FORM'
      EXPORTING
        barcdata         = lv_qrcode_data
        filename         = lv_qrcode_name
        iv_dest_pxwidth  = 470
        iv_dest_pxheight = 470.

    CALL FUNCTION lv_fm_name
      EXPORTING
        control_parameters = ls_control_param
        output_options     = ls_output_param
        iv_qrcode_name     = lv_qrcode_name
        iv_qrcode_text     = lv_qrcode_text
      EXCEPTIONS
        formatting_error   = 1
        internal_error     = 2
        send_error         = 3
        user_canceled      = 4
        OTHERS             = 5.
    IF sy-subrc <> 0.
      MESSAGE ID sy-msgid TYPE 'E' NUMBER sy-msgno
              WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
    ENDIF.
  ENDLOOP.

  lo_progress->finish( ).

  "
  CALL FUNCTION 'SSF_CLOSE'
    IMPORTING
      job_output_info  = ls_job_param
    EXCEPTIONS
      formatting_error = 1
      internal_error   = 2
      send_error       = 3
      OTHERS           = 4.
  IF sy-subrc <> 0.
    MESSAGE ID sy-msgid TYPE 'E' NUMBER sy-msgno
            WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ENDIF.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_print_parent_code
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_print_parent_code .

  DATA lv_qrcode_data TYPE char255.
  DATA lv_qrcode_name TYPE tdobname.
  DATA lv_qrcode_text TYPE char255.

  DATA:
*    lv_formname      TYPE tdsfname VALUE 'ZFSSC_PF_QRCODE', " Smartforms名称
    lv_formname      TYPE tdsfname VALUE 'ZFFI_GXYH040_QRCODE', " Smartforms名称
    lv_fm_name       TYPE rs38l_fnam,    " 函数模块名称
    ls_control_param TYPE ssfctrlop,     " 控制参数
    ls_output_param  TYPE ssfcompop,     " 输出参数
    ls_job_param     TYPE ssfcrescl.     " 输出参数

  CALL FUNCTION 'SSF_FUNCTION_MODULE_NAME'
    EXPORTING
      formname = lv_formname
    IMPORTING
      fm_name  = lv_fm_name.

  " 控制参数设置
*  ls_control_param-no_dialog = 'X'.        " 无对话框
  ls_control_param-no_open   = 'X'.        "
  ls_control_param-no_close  = 'X'.        "
  ls_control_param-preview   = 'X'.        " 非预览模式
  ls_control_param-langu     = '1'.        " 语言

  " 设置输出参数
*  ls_output_param-tddest  = p_prntr.       " 打印机
  ls_output_param-tdimmed = 'X'.           " 立即打印
  ls_output_param-tddelete = 'X'.          " 打印后删除假脱机

  CALL FUNCTION 'SSF_OPEN'
    EXPORTING
      control_parameters = ls_control_param
      output_options     = ls_output_param
    EXCEPTIONS
      formatting_error   = 1
      internal_error     = 2
      send_error         = 3
      user_canceled      = 4
      OTHERS             = 5.
  IF sy-subrc <> 0.
    MESSAGE ID sy-msgid TYPE 'E' NUMBER sy-msgno
            WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ENDIF.

  DATA(lt_data) = gt_data.
  DELETE lt_data WHERE zsel <> abap_true.
  SORT lt_data BY zmm_no zitemno gjahr.
  DELETE ADJACENT DUPLICATES FROM lt_data COMPARING zmm_no zitemno gjahr.
  DELETE lt_data WHERE zmm_no IS INITIAL.

  DATA(lo_progress) = NEW lcl_progress( ).
  lo_progress->start( total = lines( lt_data ) ).
  " 进度条比较耗性能，可以通过设置时间间隔，控制刷新频率
  lo_progress->m_interval = 1.

  LOOP AT lt_data REFERENCE INTO DATA(lr_data) WHERE zsel = abap_true.
    lo_progress->next( ).

    lv_qrcode_data = zcl_zssf_http_interface=>gen_intf_url_get_parent_code( iv_parent_code = lr_data->zmm_no
                                                                            iv_itemno      = lr_data->zitemno ).
    IF lr_data->zitemno IS NOT INITIAL.
      lv_qrcode_name = |{ lr_data->zmm_no }-{ lr_data->zitemno }|.
      lv_qrcode_text = |{ lr_data->zmm_no }-{ lr_data->zitemno }|.
    ELSE.
      lv_qrcode_name = |{ lr_data->zmm_no }|.
      lv_qrcode_text = |{ lr_data->zmm_no }|.
    ENDIF.

    CALL FUNCTION 'ZFM_MM_QRCODE_TO_FORM'
      EXPORTING
        barcdata         = lv_qrcode_data
        filename         = lv_qrcode_name
        iv_dest_pxwidth  = 470
        iv_dest_pxheight = 470.

    CALL FUNCTION lv_fm_name
      EXPORTING
        control_parameters = ls_control_param
        output_options     = ls_output_param
        iv_qrcode_name     = lv_qrcode_name
        iv_qrcode_text     = lv_qrcode_text
      EXCEPTIONS
        formatting_error   = 1
        internal_error     = 2
        send_error         = 3
        user_canceled      = 4
        OTHERS             = 5.
    IF sy-subrc <> 0.
      MESSAGE ID sy-msgid TYPE 'E' NUMBER sy-msgno
              WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
    ENDIF.
  ENDLOOP.

  lo_progress->finish( ).

  "
  CALL FUNCTION 'SSF_CLOSE'
    IMPORTING
      job_output_info  = ls_job_param
    EXCEPTIONS
      formatting_error = 1
      internal_error   = 2
      send_error       = 3
      OTHERS           = 4.
  IF sy-subrc <> 0.
    MESSAGE ID sy-msgid TYPE 'E' NUMBER sy-msgno
            WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ENDIF.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_print_cover
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_print_cover .

  " 导出Excel文件
  DATA: lo_excel     TYPE REF TO zcl_excel,
        lo_worksheet TYPE REF TO zcl_excel_worksheet,
        lv_row       TYPE i,
        lv_index     TYPE sy-index,
        lv_str       TYPE string.

  TRY.
      CREATE OBJECT lo_excel.

      " Create border object
      DATA lo_border_dark TYPE REF TO zcl_excel_style_border.
      CREATE OBJECT lo_border_dark.
      lo_border_dark->border_color-rgb = zcl_excel_style_color=>c_black.
      lo_border_dark->border_style = zcl_excel_style_border=>c_border_thin.

      " 抬头格式
      DATA: lo_style_title      TYPE REF TO zcl_excel_style,
            lv_style_title_guid TYPE zexcel_cell_style.
      lo_style_title = lo_excel->add_new_style( ).
      lo_style_title->font->family = zcl_excel_style_font=>c_family_roman.              " 设置字体
      lo_style_title->font->name = 'Microsoft YaHei'.              " 设置字体
      lo_style_title->font->size = 11.                   " 字号
      lo_style_title->font->bold = abap_true.
      lo_style_title->alignment->horizontal = zcl_excel_style_alignment=>c_horizontal_center. " 水平居中
      lo_style_title->alignment->vertical = zcl_excel_style_alignment=>c_vertical_center. " 上下居中
*    lo_style_title->borders->allborders = lo_border_dark.
      lv_style_title_guid = lo_style_title->get_guid( ).

      " 左对齐
      DATA: lo_style_align_left      TYPE REF TO zcl_excel_style,
            lv_style_align_left_guid TYPE zexcel_cell_style.
      lo_style_align_left = lo_excel->add_new_style( ).
      lo_style_align_left->font->family = zcl_excel_style_font=>c_family_roman.              " 设置字体
      lo_style_align_left->font->name = 'Microsoft YaHei'.
      lo_style_align_left->font->size = 11.
      lo_style_align_left->alignment->horizontal = zcl_excel_style_alignment=>c_horizontal_left.
      lo_style_align_left->alignment->vertical = zcl_excel_style_alignment=>c_vertical_center. " 上下居中
*      lo_style_align_left->borders->allborders = lo_border_dark.
      lv_style_align_left_guid = lo_style_align_left->get_guid( ).

      " 居中对齐
      DATA: lo_style_align_center      TYPE REF TO zcl_excel_style,
            lv_style_align_center_guid TYPE zexcel_cell_style.
      lo_style_align_center = lo_excel->add_new_style( ).
      lo_style_align_center->font->family = zcl_excel_style_font=>c_family_none.              " 设置字体
      lo_style_align_center->font->name = 'Microsoft YaHei'.
      lo_style_align_center->font->size = 11.
      lo_style_align_center->alignment->horizontal = zcl_excel_style_alignment=>c_horizontal_center. " 水平居中
      lo_style_align_center->alignment->vertical = zcl_excel_style_alignment=>c_vertical_center. " 上下居中
*      lo_style_align_center->borders->allborders = lo_border_dark.
      lv_style_align_center_guid = lo_style_align_center->get_guid( ).

      " 右对齐
      DATA: lo_style_align_right      TYPE REF TO zcl_excel_style,
            lv_style_align_right_guid TYPE zexcel_cell_style.
      lo_style_align_right = lo_excel->add_new_style( ).
      lo_style_align_right->font->family = zcl_excel_style_font=>c_family_modern.              " 设置字体
      lo_style_align_right->font->name = 'Microsoft YaHei'.
      lo_style_align_right->font->size = 11.
      lo_style_align_right->alignment->horizontal = zcl_excel_style_alignment=>c_horizontal_right. " 水平居中
      lo_style_align_right->alignment->vertical = zcl_excel_style_alignment=>c_vertical_center. " 上下居中
*      lo_style_align_right->borders->allborders = lo_border_dark.
      lv_style_align_right_guid = lo_style_align_right->get_guid( ).

      " 数字右对齐
      DATA: lo_style_align_number      TYPE REF TO zcl_excel_style,
            lv_style_align_number_guid TYPE zexcel_cell_style.
      lo_style_align_number = lo_excel->add_new_style( ).
      lo_style_align_number->font->family = zcl_excel_style_font=>c_family_modern.              " 设置字体
      lo_style_align_number->font->name = 'Microsoft YaHei'.
      lo_style_align_number->font->size = 11.
      lo_style_align_number->number_format->format_code = zcl_excel_style_number_format=>c_format_number_comma_sep1.
      lo_style_align_number->alignment->horizontal = zcl_excel_style_alignment=>c_horizontal_right. " 水平居中
      lo_style_align_number->alignment->vertical = zcl_excel_style_alignment=>c_vertical_center. " 上下居中
*      lo_style_align_number->borders->allborders = lo_border_dark.
      lv_style_align_number_guid = lo_style_align_number->get_guid( ).

      " Get active sheet
      lo_worksheet = lo_excel->get_active_worksheet( ).
      lo_worksheet->set_title( '会计档案移交目录' ).

      " 标题
      lv_row = 1.
*      lo_worksheet->set_row_height( ip_row = lv_row ip_height_fix = 30 ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'A' ip_value = '会计档案移交目录' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'B' ip_value = '' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'C' ip_value = '' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'D' ip_value = '' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'E' ip_value = '' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'F' ip_value = '' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'G' ip_value = '' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'H' ip_value = '' ip_style = lv_style_title_guid ).
      lo_worksheet->set_merge( ip_row = lv_row ip_column_start = 'A' ip_column_end = 'H' ).

      " 表抬头
      lv_row += 1.
      lv_row += 1.
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'A' ip_value = '序号' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'B' ip_value = '档号' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'C' ip_value = '提名' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'D' ip_value = '起止日期' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'E' ip_value = '保管期限' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'F' ip_value = '册数' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'G' ip_value = '页数' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'H' ip_value = '备注' ip_style = lv_style_title_guid ).

      DATA lv_tabix TYPE sy-tabix.
      LOOP AT gt_data REFERENCE INTO DATA(lr_data) WHERE zsel = abap_true.
        lv_tabix += 1.
        lv_row += 1.
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'A' ip_value = lv_tabix ip_style = lv_style_align_center_guid ).
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'B' ip_value = lr_data->zmm_no ip_style = lv_style_align_center_guid ).
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'C' ip_value = lr_data->zmmms ip_style = lv_style_align_center_guid ).
        " 起止日期
        CLEAR lv_str.
*        lv_str = |{ lr_data->zdate DATE = ISO } ~ { lr_data->zdate DATE = ISO }|.
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'D' ip_value = lv_str ip_style = lv_style_align_center_guid ).
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'E' ip_value = '' ip_style = lv_style_align_center_guid ).
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'F' ip_value = '' ip_style = lv_style_align_center_guid ).
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'G' ip_value = '' ip_style = lv_style_align_center_guid ).
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'H' ip_value = lr_data->zbz ip_style = lv_style_align_center_guid ).
      ENDLOOP.

      lo_worksheet->set_column_width( ip_column = 'A' ip_width_fix = 6 ). " 序号
      lo_worksheet->set_column_width( ip_column = 'B' ip_width_fix = 15 ). " 档号
      lo_worksheet->set_column_width( ip_column = 'C' ip_width_fix = 40 ). " 提名
      lo_worksheet->set_column_width( ip_column = 'D' ip_width_fix = 25 ). " 起止日期
      lo_worksheet->set_column_width( ip_column = 'E' ip_width_fix = 20 ). " 保管期限
      lo_worksheet->set_column_width( ip_column = 'F' ip_width_fix = 10 ). " 册数
      lo_worksheet->set_column_width( ip_column = 'G' ip_width_fix = 10 ). " 页数
      lo_worksheet->set_column_width( ip_column = 'H' ip_width_fix = 80 ). " 备注

    CATCH zcx_excel.
      MESSAGE '导出Excel文件失败' TYPE 'S' DISPLAY LIKE 'E'.
      RETURN.
  ENDTRY.

  DATA:
    lo_writer    TYPE REF TO zif_excel_writer,
    lv_file_name TYPE string,
    lv_file      TYPE xstring.

  CREATE OBJECT lo_writer TYPE zcl_excel_writer_2007.


  lv_file_name = cl_openxml_helper=>browse_local_file_save(
    iv_title      = '保存'
    iv_filename   = |会计档案移交目录.xlsx|
    iv_extpattern = '*.xlsx|*.xlsx' ).

  IF lv_file_name IS NOT INITIAL.
    lv_file = lo_writer->write_file( lo_excel ).
    TRY.
        cl_openxml_helper=>store_local_file( im_file_name = lv_file_name
                                             im_data      = lv_file ).
      CATCH cx_openxml_not_allowed.
        MESSAGE '保存Excel文件失败' TYPE 'S' DISPLAY LIKE 'E'.
        RETURN.
    ENDTRY.
  ENDIF.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_popup_create_volume
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_popup_create_volume .

  " 公司代码从选择屏幕取值
  IF p_vol1 IS INITIAL AND s_bukrs[] IS NOT INITIAL.
    p_vol1 = s_bukrs[ 1 ]-low.
  ENDIF.

  " 年度从选择屏幕取值
  IF p_vol2 IS INITIAL AND s_gjahr[] IS NOT INITIAL.
    p_vol2 = s_gjahr[ 1 ]-low.
  ENDIF.
  IF p_vol2 IS INITIAL.
    p_vol2 = sy-datum.
  ENDIF.

  " 期间
  IF p_vol3 IS INITIAL AND s_poper[] IS NOT INITIAL.
    p_vol3 = s_poper[ 1 ]-low.
  ENDIF.
  IF p_vol3 IS INITIAL.
    p_vol3 = sy-datum+4(2).
  ENDIF.

  " 利润中心
  IF p_vol4 IS INITIAL AND s_prctr[] IS NOT INITIAL.
    p_vol4 = s_prctr[ 1 ]-low.
  ENDIF.

  " 星号检查
  DATA lv_msg TYPE string.
  DEFINE _def_star_check.
    IF &1 CS '*'.
      lv_msg = |{ &2 }不可包含*|.
      MESSAGE lv_msg TYPE 'S' DISPLAY LIKE 'E'.
      RETURN.
    ENDIF.
  END-OF-DEFINITION.
  _def_star_check p_vol1 '公司代码'.
  _def_star_check p_vol2 '年度'.
  _def_star_check p_vol3 '期间'.
  _def_star_check p_vol4 '利润中心'.

  " 母码创建日期
  p_vol10 = sy-datum.
  CALL FUNCTION 'FIMA_DATE_CREATE'
    EXPORTING
      i_date   = sy-datum
      i_months = -1
    IMPORTING
      e_date   = p_vol10.

  " 根据公司代码和利润中心带出物理位置和档案员
  PERFORM frm_fetch_volume_wlwz.

  p_volt1 = '物理位置、档案员、档案员名称根据公司代码和利润中心带出'.
  p_volt2 = '如为空，请联系运维人员维护'.
*&&--------Begin of Mod: S/4 SHYY_ABAP04_20.06.2025 10:44:58
*&&--------Begin of Mod: S/4 SHYY_ABAP04_29.07.2026 09:00:00
  " 修复：MAX(ZHH) 字典序导致 '9' > '10'，改为 ABAP 层数值求最大
  SELECT zhh FROM zfit_ysfj_0003
    WHERE bukrs = @p_vol1
      AND gjahr = @p_vol2
      AND poper = @p_vol3
      AND prctr = @p_vol4
    INTO TABLE @DATA(lt_zhh_list).
  DATA lv_max_zhh TYPE i.
  LOOP AT lt_zhh_list INTO DATA(lv_zhh_char).
    TRY.
        DATA(lv_num) = CONV i( lv_zhh_char ).
        IF lv_num > lv_max_zhh.
          lv_max_zhh = lv_num.
        ENDIF.
      CATCH cx_root.
    ENDTRY.
  ENDLOOP.
  p_vol5 = |{ lv_max_zhh + 1 }|.
*&&--------End of Mod: S/4 SHYY_ABAP04_29.07.2026 09:00:00
*&&--------End of Mod: S/4 SHYY_ABAP04_20.06.2025 10:44:58
  p_crtvol = abap_true.
  CALL SELECTION-SCREEN '0100' STARTING AT 40 5.
  IF p_crtvol IS INITIAL.
    RETURN.
  ENDIF.
  CLEAR p_crtvol.

  DATA ls_info TYPE zcl_zssf_archive=>ty_parent_code_info.
  ls_info-bukrs = p_vol1.
  ls_info-gjahr = p_vol2.
  ls_info-poper = p_vol3.
  ls_info-prctr = p_vol4.
  ls_info-zhh   = p_vol5.
  ls_info-zjh   = p_vol6.
  ls_info-zfch  = p_vol7.
  ls_info-zgh   = p_vol8.
  ls_info-zwlwz = p_vol9.
  ls_info-zdat  = p_vol10.
  ls_info-zerp_code = p_vol11.
  ls_info-zerp_name = p_vol12.

  DATA(lo_archive) = NEW zcl_zssf_archive( ).
  lo_archive->generate_parent_code( is_info   = ls_info
                                    iv_manual = abap_true ).

  " 重新取值
  PERFORM frm_get_data.

ENDFORM.
*&&--------Begin of Mod: S/4 SHYY_ABAP04_01.06.2026 10:28:35
*&---------------------------------------------------------------------*
*& Form frm_popup_delete_volume
*&---------------------------------------------------------------------*
*& 删除母码
*&---------------------------------------------------------------------*
FORM frm_popup_delete_volume .

  DATA(lt_data) = gt_data.
  DELETE lt_data WHERE zsel <> abap_true.
  SORT lt_data BY zmm_no.
  DELETE lt_data WHERE zmm_no IS INITIAL.

  IF lt_data IS INITIAL.
    MESSAGE '请选择需要删除的母码' TYPE 'S' DISPLAY LIKE 'E'.
    RETURN.
  ENDIF.

  " 检查每个选中的母码
  LOOP AT lt_data REFERENCE INTO DATA(lr_data).
    " 检查该母码是否在ZFIT_YSFJ_0002表中有装盒的子码记录
    SELECT SINGLE zzm_no FROM zfit_ysfj_0002
      WHERE zmm_no = @lr_data->zmm_no
        AND zzt = @zcl_zssf_archive=>cns_archive_state-boxed
      INTO @DATA(lv_zzm_no).
    IF sy-subrc = 0.
      MESSAGE |母码 { lr_data->zmm_no } 已使用，不允许删除| TYPE 'S' DISPLAY LIKE 'E'.
      RETURN.
    ENDIF.
  ENDLOOP.

  " 弹出确认对话框
  DATA lv_answer TYPE char1.
  CALL FUNCTION 'POPUP_TO_CONFIRM'
    EXPORTING
      titlebar              = '确认删除'
      text_question         = '请确认是否删除该母码，删除后不可恢复'
      text_button_1         = '是'
      icon_button_1         = 'ICON_OKAY'
      text_button_2         = '否'
      icon_button_2         = 'ICON_CANCEL'
      default_button        = '2'
      display_cancel_button = ' '
    IMPORTING
      answer                = lv_answer
    EXCEPTIONS
      text_not_found        = 1
      OTHERS                = 2.
  IF sy-subrc <> 0 OR lv_answer <> '1'.
    RETURN.
  ENDIF.

  " 执行删除操作
  LOOP AT lt_data REFERENCE INTO lr_data.
    " 删除母码主表记录
    DELETE FROM zfit_ysfj_0003 WHERE zmm_no = @lr_data->zmm_no.
    IF sy-subrc = 0.
      COMMIT WORK AND WAIT.
    ELSE.
      ROLLBACK WORK.
      MESSAGE |母码 { lr_data->zmm_no } 删除失败| TYPE 'S' DISPLAY LIKE 'E'.
      RETURN.
    ENDIF.
  ENDLOOP.

  MESSAGE '母码删除成功' TYPE 'S'.

  " 重新获取数据刷新显示
  PERFORM frm_get_data.

ENDFORM.
*&&--------End of Mod: S/4 SHYY_ABAP04_01.06.2026 10:28:35
*&---------------------------------------------------------------------*
*& Form frm_popup_create_archive
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_popup_create_archive.

  " 公司代码
  IF p_arc1 IS INITIAL AND s_bukrs[] IS NOT INITIAL.
    p_arc1 = s_bukrs[ 1 ]-low.
  ENDIF.

  " 年度
  IF p_arc2 IS INITIAL AND s_gjahr[] IS NOT INITIAL.
    p_arc2 = s_gjahr[ 1 ]-low.
  ENDIF.
  IF p_arc2 IS INITIAL.
    p_arc2 = sy-datum.
  ENDIF.

  " 期间
  IF p_arc3 IS INITIAL AND s_poper[] IS NOT INITIAL.
    p_arc3 = s_poper[ 1 ]-low.
  ENDIF.
  IF p_arc3 IS INITIAL.
    p_arc3 = sy-datum+4(2).
  ENDIF.

  " 利润中心
  IF p_arc4 IS INITIAL AND s_prctr[] IS NOT INITIAL.
    p_arc4 = s_prctr[ 1 ]-low.
  ENDIF.

  " 星号检查
  DATA lv_msg TYPE string.
  DEFINE _def_star_check.
    IF &1 CS '*'.
      lv_msg = |{ &2 }不可包含*|.
      MESSAGE lv_msg TYPE 'S' DISPLAY LIKE 'E'.
      RETURN.
    ENDIF.
  END-OF-DEFINITION.
  _def_star_check p_arc1 '公司代码'.
  _def_star_check p_arc2 '年度'.
  _def_star_check p_arc3 '期间'.
  _def_star_check p_arc4 '利润中心'.

  " 除了主键没其他信息，不用确认
*  p_crtarc = abap_true.
*  CLEAR p_crtarc.
*  CALL SELECTION-SCREEN '0200' STARTING AT 40 5.
*  IF p_crtarc IS INITIAL.
*    RETURN.
*  ENDIF.
*  CLEAR p_crtarc.

  DATA ls_info TYPE zcl_zssf_archive=>ty_sub_code_info.
  ls_info-bukrs = p_arc1.
  ls_info-gjahr = p_arc2.
  ls_info-poper = p_arc3.
  ls_info-prctr = p_arc4.
  ls_info-zwlczm = abap_true.

  DATA(lo_archive) = NEW zcl_zssf_archive( ).
  lo_archive->generate_archive_code_wout_obj( is_info   = ls_info
                                              iv_manual = abap_true ).

  " 重新取值
  PERFORM frm_get_data.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_selscr_pbo
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_selscr_pbo .

  DATA lt_exclude TYPE STANDARD TABLE OF sy-ucomm.
  CASE abap_true.
    WHEN p_crtvol.
      " 母码
      CALL FUNCTION 'RS_SET_SELSCREEN_STATUS'
        EXPORTING
          p_status  = 'PF_VOLUME'
        TABLES
          p_exclude = lt_exclude.
    WHEN p_crtarc.
      " 子码
      CALL FUNCTION 'RS_SET_SELSCREEN_STATUS'
        EXPORTING
          p_status  = 'PF_ARCHIVE'
        TABLES
          p_exclude = lt_exclude.
    WHEN OTHERS.
  ENDCASE.

  PERFORM frm_volume_pbo.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_selscr_pai
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_selscr_pai .

  CASE abap_true.
    WHEN p_crtvol.
      PERFORM frm_selscr_pai_volume.
    WHEN p_crtvol.
      PERFORM frm_selscr_pai_archive.
    WHEN OTHERS.
  ENDCASE.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_selscr_pai_volume
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_selscr_pai_volume .

  CASE sy-ucomm.
    WHEN 'ENTER'.
      " 根据公司代码和利润中心查找物理位置
      PERFORM frm_fetch_volume_wlwz.

    WHEN 'SAVE'.
      LEAVE TO SCREEN 0.
    WHEN 'CANC'.
      CLEAR p_crtvol.
      LEAVE TO SCREEN 0.
    WHEN OTHERS.
      RETURN.
  ENDCASE.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_selscr_pai_archive
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_selscr_pai_archive .

  CASE sy-ucomm.
    WHEN 'SAVE'.
      LEAVE TO SCREEN 0.
    WHEN 'CANC'.
      CLEAR p_crtarc.
      LEAVE TO SCREEN 0.
    WHEN OTHERS.
      RETURN.
  ENDCASE.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_volume_pbo
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_volume_pbo .

  LOOP AT SCREEN.
    CASE screen-name.
      WHEN 'P_VOL9' " 物理位置
        OR 'P_VOL11' " 档案员
        OR 'P_VOL12'. " 物理员名称
        screen-input = 0.
        MODIFY SCREEN.
      WHEN OTHERS.
    ENDCASE.
  ENDLOOP.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_print_cover_pdf
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_print_cover_pdf .

  DATA(lt_volume) = gt_data.
  DELETE lt_volume WHERE zsel <> abap_true.
  DELETE lt_volume WHERE zmm_no IS INITIAL.
  SORT lt_volume BY zmm_no zitemno zzm_no.
  DELETE ADJACENT DUPLICATES FROM lt_volume COMPARING zmm_no zitemno.
  IF lt_volume IS INITIAL.
    MESSAGE '请选择打印数据' TYPE 'S' DISPLAY LIKE 'E'.
    RETURN.
  ENDIF.

  DATA:
    lv_fm_name       TYPE rs38l_fnam,    " 函数模块名称
    ls_control_param TYPE ssfctrlop,     " 控制参数
    ls_output_param  TYPE ssfcompop,     " 输出参数
    ls_job_param     TYPE ssfcrescl.     " 输出参数

  CALL FUNCTION 'SSF_FUNCTION_MODULE_NAME'
    EXPORTING
      formname = 'ZFFI_GXYH040_COVER'
    IMPORTING
      fm_name  = lv_fm_name.

  " 控制参数设置
*  ls_control_param-no_dialog = 'X'.        " 无对话框
  ls_control_param-no_open   = 'X'.        "
  ls_control_param-no_close  = 'X'.        "
  ls_control_param-preview   = 'X'.        " 非预览模式
  ls_control_param-langu     = '1'.        " 语言

  " 设置输出参数
*  ls_output_param-tddest  = p_prntr.       " 打印机
  ls_output_param-tdimmed = 'X'.           " 立即打印
  ls_output_param-tddelete = 'X'.          " 打印后删除假脱机

  CALL FUNCTION 'SSF_OPEN'
    EXPORTING
      control_parameters = ls_control_param
      output_options     = ls_output_param
    EXCEPTIONS
      formatting_error   = 1
      internal_error     = 2
      send_error         = 3
      user_canceled      = 4
      OTHERS             = 5.
  IF sy-subrc <> 0.
    MESSAGE ID sy-msgid TYPE 'E' NUMBER sy-msgno
            WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ENDIF.

  DATA(lo_progress) = NEW lcl_progress( ).
  lo_progress->start( total = lines( lt_volume ) ).
  " 进度条比较耗性能，可以通过设置时间间隔，控制刷新频率
  lo_progress->m_interval = 1.

  LOOP AT gt_data REFERENCE INTO DATA(lr_data)
    GROUP BY (
      zmm_no = lr_data->zmm_no
      zitemno = lr_data->zitemno
    ) REFERENCE INTO DATA(lr_data_grp).

    READ TABLE lt_volume TRANSPORTING NO FIELDS WITH KEY
    zmm_no = lr_data_grp->zmm_no
    zitemno = lr_data_grp->zitemno
    BINARY SEARCH.
    IF sy-subrc <> 0.
      CONTINUE.
    ENDIF.

    lo_progress->next( ).

    DATA lv_qrcode_data TYPE char255.
    DATA lv_qrcode_name TYPE tdobname.
    DATA lv_qrcode_text TYPE char255.

    lv_qrcode_data = zcl_zssf_http_interface=>gen_intf_url_get_parent_code( iv_parent_code = lr_data_grp->zmm_no
                                                                            iv_itemno      = lr_data_grp->zitemno ).
    IF lr_data_grp->zitemno IS NOT INITIAL.
      lv_qrcode_name = |{ lr_data_grp->zmm_no }-{ lr_data_grp->zitemno }|.
      lv_qrcode_text = |{ lr_data_grp->zmm_no }-{ lr_data_grp->zitemno }|.
    ELSE.
      lv_qrcode_name = |{ lr_data_grp->zmm_no }|.
      lv_qrcode_text = |{ lr_data_grp->zmm_no }|.
    ENDIF.

    CALL FUNCTION 'ZFM_MM_QRCODE_TO_FORM'
      EXPORTING
        barcdata         = lv_qrcode_data
        filename         = lv_qrcode_name
        iv_dest_pxwidth  = 470
        iv_dest_pxheight = 470.

    DATA lt_print_data TYPE zfit_gxyh040_cover.
    DATA ls_print_data TYPE zfis_gxyh040_cover.

    SELECT * FROM zfit_ysfj_0002
      WHERE zmm_no = @lr_data_grp->zmm_no
        AND zitemno = @lr_data_grp->zitemno
      INTO TABLE @DATA(lt_archive).
    SORT lt_archive BY zmm_no bukrs gjahr zzm_no.

*&&--------Begin of Mod: S/4 SHYY_ABAP04_26.02.2026 14:53:06
    " 凭证流水号
    SELECT
      a~bukrs,
      a~belnr,
      a~gjahr,
      a~xref1_hd
      FROM @lt_archive AS ds
      INNER JOIN bkpf AS a
        ON ds~bukrs = a~bukrs
       AND ds~belnr = a~belnr
*       AND ds~gjahr = a~gjahr " SHYY_ABAP04_31.03.2026 14:53:53
       AND left( ds~budat, 4 ) = a~gjahr " SHYY_ABAP04_31.03.2026 14:53:54
      INTO TABLE @DATA(lt_xref1).
    SORT lt_xref1 BY bukrs belnr gjahr.
*&&--------End of Mod: S/4 SHYY_ABAP04_26.02.2026 14:53:06

*&&--------Begin of Mod: S/4 SHYY_ABAP04_26.02.2026 11:31:36
    " 查找装盒时间
    DATA lt_boxed_log TYPE STANDARD TABLE OF zfit_ysfj_0010.
    SELECT log~* FROM @lt_archive AS ds
      INNER JOIN zfit_ysfj_0010 AS log
        ON ds~zzm_no = log~zzm_no
       AND ds~bukrs = log~bukrs
       AND ds~gjahr = log~gjahr
      INTO TABLE @lt_boxed_log.
    " 取最新处理状态
    SORT lt_boxed_log BY zzm_no bukrs gjahr datum DESCENDING uzeit DESCENDING.
    DELETE ADJACENT DUPLICATES FROM lt_boxed_log COMPARING zzm_no bukrs gjahr.
    " 仅取已装盒状态
    DELETE lt_boxed_log WHERE zzt_to <> zcl_zssf_archive=>cns_archive_state-boxed.
*&&--------End of Mod: S/4 SHYY_ABAP04_26.02.2026 11:31:36

    CLEAR lt_print_data.
    LOOP AT lt_archive REFERENCE INTO DATA(lr_archive).
*&&--------Begin of Mod: S/4 SHYY_ABAP04_26.02.2026 14:55:26
      READ TABLE lt_xref1 REFERENCE INTO DATA(lr_xref1) WITH KEY
      bukrs = lr_archive->bukrs
      belnr = lr_archive->belnr
*      gjahr = lr_archive->gjahr " SHYY_ABAP04_31.03.2026 14:54:30
      gjahr = lr_archive->budat(4) " SHYY_ABAP04_31.03.2026 14:54:39
      BINARY SEARCH.
      IF sy-subrc = 0.
        lr_archive->xref1_hd = lr_xref1->xref1_hd.
      ENDIF.
*&&--------End of Mod: S/4 SHYY_ABAP04_26.02.2026 14:55:26

      CLEAR ls_print_data.
      MOVE-CORRESPONDING lr_archive->* TO ls_print_data.
*&&--------Begin of Mod: S/4 SHYY_ABAP04_26.02.2026 11:35:05
**&&--------Begin of Mod: S/4 SHYY_ABAP04_10.12.2025 16:13:20
*      TRY.
*          ls_print_data-boxed_date = lr_archive->zfield2.
*          ls_print_data-boxed_time = lr_archive->zfield3.
*        CATCH cx_root.
*      ENDTRY.
**&&--------End of Mod: S/4 SHYY_ABAP04_10.12.2025 16:13:20
      READ TABLE lt_boxed_log REFERENCE INTO DATA(lr_boxed_log) WITH KEY
      zzm_no = lr_archive->zzm_no
      bukrs = lr_archive->bukrs
      gjahr = lr_archive->gjahr
      BINARY SEARCH.
      IF sy-subrc = 0.
        ls_print_data-boxed_date = lr_boxed_log->datum.
        ls_print_data-boxed_time = lr_boxed_log->uzeit.
        ls_print_data-boxed_itemno = lr_boxed_log->zitem.
      ENDIF.
*&&--------End of Mod: S/4 SHYY_ABAP04_26.02.2026 11:35:05
      IF lr_archive->zitemno IS NOT INITIAL.
        ls_print_data-zmm_no = |{ lr_archive->zmm_no }-{ lr_archive->zitemno }|.
      ENDIF.
      INSERT ls_print_data INTO TABLE lt_print_data.
    ENDLOOP.

*&&--------Begin of Mod: S/4 SHYY_ABAP04_26.02.2026 15:01:37
*    SORT lt_print_data BY zmm_no zzm_no.
*    SORT lt_print_data BY zmm_no boxed_date boxed_time zzm_no. " 按扫描时间排序 " SHYY_ABAP04_10.12.2025 16:13:16

    " 按扫描时间排序
    SORT lt_print_data BY zmm_no
                          boxed_date boxed_time boxed_itemno
                          zzm_no bukrs gjahr.
*&&--------End of Mod: S/4 SHYY_ABAP04_26.02.2026 15:01:37
    LOOP AT lt_print_data REFERENCE INTO DATA(lr_print_data).
      lr_print_data->itemno = sy-tabix.
    ENDLOOP.

*&&--------Begin of Mod: S/4 SHYY_ABAP04_29.07.2026 08:30:00
    " 构建表头信息：从母码数据取单位/年度/期间/盒号/子码数量
    DATA ls_header TYPE zfis_gxyh040_cover_head.
    READ TABLE gt_data REFERENCE INTO DATA(lr_hdr) WITH KEY
      zmm_no  = lr_data_grp->zmm_no
      zitemno = lr_data_grp->zitemno
      BINARY SEARCH.
    IF sy-subrc = 0.
      ls_header-prctr_text = lr_hdr->prctr_text.
      ls_header-gjahr      = lr_hdr->gjahr.
      ls_header-poper      = lr_hdr->poper.
      ls_header-zhh        = lr_hdr->zhh.
    ENDIF.
    ls_header-sub_count = lines( lt_archive ).
*&&--------End of Mod: S/4 SHYY_ABAP04_29.07.2026 08:30:00

    CALL FUNCTION lv_fm_name
      EXPORTING
        control_parameters = ls_control_param
        output_options     = ls_output_param
        it_data            = lt_print_data
        iv_qrcode_name     = lv_qrcode_name
        is_header          = ls_header
      EXCEPTIONS
        formatting_error   = 1
        internal_error     = 2
        send_error         = 3
        user_canceled      = 4
        OTHERS             = 5.
    IF sy-subrc <> 0.
      MESSAGE ID sy-msgid TYPE 'E' NUMBER sy-msgno
              WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
    ENDIF.
  ENDLOOP.

  lo_progress->finish( ).

  "
  CALL FUNCTION 'SSF_CLOSE'
    IMPORTING
      job_output_info  = ls_job_param
    EXCEPTIONS
      formatting_error = 1
      internal_error   = 2
      send_error       = 3
      OTHERS           = 4.
  IF sy-subrc <> 0.
    MESSAGE ID sy-msgid TYPE 'E' NUMBER sy-msgno
            WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ENDIF.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_get_archive_data
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_get_archive_data .

  DATA lt_archive TYPE STANDARD TABLE OF zfit_ysfj_0002.
  DATA lt_volume TYPE STANDARD TABLE OF zfit_ysfj_0003.

  " 子码
  SELECT * FROM zfit_ysfj_0002
    WHERE bukrs IN @s_bukrs
      AND gjahr IN @s_gjahr
      AND poper IN @s_poper
      AND budat IN @s_budat " SHYY_ABAP04_19.01.2026 10:01:05
      AND prctr IN @s_prctr
      AND zzm_no IN @s_subcod
      AND zmm_no IN @s_parent
*      AND zwlczm = @abap_true
    INTO TABLE @lt_archive.
  IF sy-subrc <> 0.
    RETURN.
  ENDIF.

  " 同时更新下凭证号
  DATA(lo_archive) = NEW zcl_zssf_archive( ).
  LOOP AT lt_archive REFERENCE INTO DATA(lr_archive) WHERE belnr IS INITIAL.
    lo_archive->link_sap_voucher_to_archive( iv_sub_code = lr_archive->zzm_no
                                             iv_bukrs    = lr_archive->bukrs
                                             iv_gjahr    = lr_archive->gjahr ).
  ENDLOOP.
  IF sy-subrc = 0.
    " 重新取值下
    SELECT * FROM zfit_ysfj_0002
      WHERE bukrs IN @s_bukrs
        AND gjahr IN @s_gjahr
        AND poper IN @s_poper
        AND budat IN @s_budat
        AND prctr IN @s_prctr
        AND zzm_no IN @s_subcod
        AND zmm_no IN @s_parent
*        AND zwlczm = @abap_true
      INTO TABLE @lt_archive.
  ENDIF.

  " 母码
  SELECT * FROM zfit_ysfj_0003
    WHERE zmm_no IN @s_parent
      AND bukrs IN @s_bukrs
      AND gjahr IN @s_gjahr
      AND poper IN @s_poper
      AND prctr IN @s_prctr
    INTO TABLE @lt_volume.

  SORT lt_volume BY zmm_no.
  SORT lt_archive BY bukrs gjahr zzm_no.

*&&--------Begin of Mod: S/4 SHYY_ABAP04_19.01.2026 10:58:30
  " 附件类型
  ##ITAB_KEY_IN_SELECT
  WITH +ds AS ( SELECT objtype, objkey FROM @lt_archive AS ds GROUP BY objtype, objkey )
  SELECT wf~objtype, wf~objkey, wf~zfjlx
    FROM +ds AS ds
    INNER JOIN zwf_object AS wf
       ON ds~objtype = wf~objtype
      AND ds~objkey = wf~objkey
    INTO TABLE @DATA(lt_wf).
  SORT lt_wf BY objtype objkey.
*&&--------End of Mod: S/4 SHYY_ABAP04_19.01.2026 10:58:30

  " 以子码为主题，关联母码信息
  LOOP AT lt_archive REFERENCE INTO lr_archive.
    CLEAR gs_data.
    gs_data = CORRESPONDING #( lr_archive->* ).
    gs_data-zzt_sub = lr_archive->zzt.

    READ TABLE lt_volume REFERENCE INTO DATA(lr_volume) WITH KEY zmm_no = lr_archive->zmm_no BINARY SEARCH.
    IF sy-subrc = 0.
      MOVE-CORRESPONDING lr_volume->* TO gs_data.
    ENDIF.

*&&--------Begin of Mod: S/4 SHYY_ABAP04_19.01.2026 10:59:56
    READ TABLE lt_wf REFERENCE INTO DATA(lr_wf) WITH KEY
    objtype = gs_data-objtype
    objkey = gs_data-objkey
    BINARY SEARCH.
    IF sy-subrc = 0.
      gs_data-zfjlx = lr_wf->zfjlx.
    ENDIF.
*&&--------End of Mod: S/4 SHYY_ABAP04_19.01.2026 10:59:56

    INSERT gs_data INTO TABLE gt_data.
  ENDLOOP.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_get_volume_data
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_get_volume_data .

  " 母码
  SELECT * FROM zfit_ysfj_0003
    WHERE zmm_no IN @s_parent
      AND bukrs IN @s_bukrs
      AND gjahr IN @s_gjahr
      AND poper IN @s_poper
      AND prctr IN @s_prctr
    INTO TABLE @DATA(lt_volume).

  LOOP AT lt_volume REFERENCE INTO DATA(lr_volume).
    CLEAR gs_data.
    MOVE-CORRESPONDING lr_volume->* TO gs_data.
    INSERT gs_data INTO TABLE gt_data.
  ENDLOOP.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_fetch_volume_wlwz
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_fetch_volume_wlwz .

  SELECT SINGLE * FROM zfit_ysfj_0006
    WHERE bukrs = @p_vol1
      AND prctr = @p_vol4
    INTO @DATA(ls_wlwz).
  p_vol9 = ls_wlwz-zwlwz.
  p_vol11 = ls_wlwz-zerp_code.
  p_vol12 = ls_wlwz-zerp_name.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_auth_check
*&---------------------------------------------------------------------*
*& text
*&---------------------------------------------------------------------*
*& -->  p1        text
*& <--  p2        text
*&---------------------------------------------------------------------*
FORM frm_auth_check .

  CASE abap_true.
    WHEN r_sub.
      AUTHORITY-CHECK OBJECT 'ZFIW030B' ID 'ACTVT' FIELD '16'.
      IF sy-subrc <> 0.
        MESSAGE '无子码查询权限' TYPE 'S' DISPLAY LIKE 'E'.
        LEAVE LIST-PROCESSING.
      ENDIF.
    WHEN r_par.
      AUTHORITY-CHECK OBJECT 'ZFIW030A' ID 'ACTVT' FIELD '16'.
      IF sy-subrc <> 0.
        MESSAGE '无母码查询权限' TYPE 'S' DISPLAY LIKE 'E'.
        LEAVE LIST-PROCESSING.
      ENDIF.
    WHEN r_cov.
      AUTHORITY-CHECK OBJECT 'ZFIW030C' ID 'ACTVT' FIELD '16'.
      IF sy-subrc <> 0.
        MESSAGE '无打印目录权限' TYPE 'S' DISPLAY LIKE 'E'.
        LEAVE LIST-PROCESSING.
      ENDIF.
  ENDCASE.

  " 公司代码
  SELECT bukrs FROM t001 WHERE bukrs IN @s_bukrs INTO TABLE @DATA(lt_t001).
  IF sy-subrc <> 0.
    MESSAGE '公司代码不存在' TYPE 'S' DISPLAY LIKE 'E'.
    LEAVE LIST-PROCESSING.
  ENDIF.

  " 利润中心
  SELECT prctr, kokrs FROM cepc WHERE prctr IN @s_prctr INTO TABLE @DATA(lt_cepc).
  IF sy-subrc <> 0.
    MESSAGE '利润中心不存在' TYPE 'S' DISPLAY LIKE 'E'.
    LEAVE LIST-PROCESSING.
  ENDIF.

*&&--------Begin of Mod: S/4 SJ00_ABAP04_08.06.2026 09:11:30
  SORT lt_cepc BY prctr.
  DELETE ADJACENT DUPLICATES FROM lt_cepc COMPARING prctr.

  LOOP AT lt_cepc INTO DATA(ls_cepc).
    AUTHORITY-CHECK OBJECT 'K_PCAR_REP'
      ID 'PRCTR' FIELD ls_cepc-prctr
      ID 'ACTVT' FIELD '03'.

    IF sy-subrc <> 0.
      MESSAGE |利润中心[{ ls_cepc-prctr }]无权限| TYPE 'S' DISPLAY LIKE 'E'.
      LEAVE LIST-PROCESSING.
    ENDIF.
  ENDLOOP.
*&&--------End of Mod: S/4 SJ00_ABAP04_08.06.2026 09:11:30

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_create_volume_itemno
*&---------------------------------------------------------------------*
*& 创建母码二级编号
*&---------------------------------------------------------------------*
*&&--------Begin of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL
*&---------------------------------------------------------------------*
*& Form frm_export_volume_excel
*&---------------------------------------------------------------------*
*& 母码信息导出EXCEL(实物档案归档信息表)
*& 模板:第1行表头12列,第2行起数据,二维码输出到L列单元格
*&---------------------------------------------------------------------*
*&---------------------------------------------------------------------*
*& Form frm_create_volume_itemno
*&---------------------------------------------------------------------*
*& 创建母码二级编号
*&---------------------------------------------------------------------*
FORM frm_create_volume_itemno .

  DATA(lt_data) = gt_data.
  DELETE lt_data WHERE zsel <> abap_true.

  SORT lt_data BY zmm_no.
  DELETE lt_data WHERE zmm_no IS INITIAL.
  IF lines( lt_data ) <> 1.
    MESSAGE '请选择一行需要创建二级编号的母码编号' TYPE 'S' DISPLAY LIKE 'E'.
    RETURN.
  ENDIF.

  DATA(lo_archive) = NEW zcl_zssf_archive( ).
  lo_archive->add_parent_code_itemno( iv_parent_code = lt_data[ 1 ]-zmm_no ).

  " 重新取值
  PERFORM frm_get_data.

ENDFORM.

*&&--------Begin of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL
*&---------------------------------------------------------------------*
*& Form frm_export_volume_excel
*&---------------------------------------------------------------------*
*& 母码信息导出EXCEL(实物档案归档信息表)
*& 模板:第1行表头12列,第2行起数据,二维码输出到L列单元格
*&---------------------------------------------------------------------*
FORM frm_export_volume_excel .

  " 取勾选的母码数据
  DATA(lt_volume) = gt_data.
  DELETE lt_volume WHERE zsel <> abap_true.
  DELETE lt_volume WHERE zmm_no IS INITIAL.
  SORT lt_volume BY zmm_no zitemno.
  DELETE ADJACENT DUPLICATES FROM lt_volume COMPARING zmm_no zitemno.
  IF lt_volume IS INITIAL.
    MESSAGE '请选择需要导出的母码数据' TYPE 'S' DISPLAY LIKE 'E'.
    RETURN.
  ENDIF.

  " 物理位置配置(负责人/装订人按母码利润中心取)
  SELECT bukrs, prctr, zerp_name, zfzr
    FROM zfit_ysfj_0006
    FOR ALL ENTRIES IN @lt_volume
    WHERE bukrs = @lt_volume-bukrs
      AND prctr = @lt_volume-prctr
    INTO TABLE @DATA(lt_wlwz_cfg).
  SORT lt_wlwz_cfg BY bukrs prctr.

  " 共几册:同利润中心+年度+期间下的最大盒号
  ##ITAB_KEY_IN_SELECT
  SELECT ds~prctr, ds~gjahr, ds~poper, MAX( mm~zhh ) AS zhh_max
    FROM @lt_volume AS ds
    INNER JOIN zfit_ysfj_0003 AS mm
      ON ds~prctr = mm~prctr
     AND ds~gjahr = mm~gjahr
     AND ds~poper = mm~poper
    GROUP BY ds~prctr, ds~gjahr, ds~poper
    INTO TABLE @DATA(lt_zhh_max).
  SORT lt_zhh_max BY prctr gjahr poper.

  " 原始凭证:母码+二级编号下的子码条数
  ##ITAB_KEY_IN_SELECT
  SELECT ds~zmm_no, ds~zitemno, COUNT( * ) AS sub_count
    FROM @lt_volume AS ds
    INNER JOIN zfit_ysfj_0002 AS a
      ON ds~zmm_no = a~zmm_no
     AND ds~zitemno = a~zitemno
    GROUP BY ds~zmm_no, ds~zitemno
    INTO TABLE @DATA(lt_sub_cnt).
  SORT lt_sub_cnt BY zmm_no zitemno.

*&&--------Begin of Mod: S/4 SHYY_ABAP04_20.08.2026 17:10:22
  " 负责人/装订人:优先ZFIT_YSFJ_0006-ZFZR(负责人)/ZERP_NAME(装订人)
*&&--------End of Mod: S/4 SHYY_ABAP04_20.08.2026 17:10:22

  DATA: lo_excel     TYPE REF TO zcl_excel,
        lo_worksheet TYPE REF TO zcl_excel_worksheet,
        lv_row       TYPE i.

  TRY.
      CREATE OBJECT lo_excel.
      lo_worksheet = lo_excel->get_active_worksheet( ).
      lo_worksheet->set_title( '实物档案归档信息表' ).

      " 表头样式(参照frm_print_cover)
      DATA: lo_style_title      TYPE REF TO zcl_excel_style,
            lv_style_title_guid TYPE zexcel_cell_style.
      lo_style_title = lo_excel->add_new_style( ).
      lo_style_title->font->name = 'Microsoft YaHei'.
      lo_style_title->font->size = 11.
      lo_style_title->alignment->horizontal = zcl_excel_style_alignment=>c_horizontal_center.
      lo_style_title->alignment->vertical = zcl_excel_style_alignment=>c_vertical_center.
      lv_style_title_guid = lo_style_title->get_guid( ).

      " 居中样式
      DATA: lo_style_center      TYPE REF TO zcl_excel_style,
            lv_style_center_guid TYPE zexcel_cell_style.
      lo_style_center = lo_excel->add_new_style( ).
      lo_style_center->font->name = 'Microsoft YaHei'.
      lo_style_center->font->size = 11.
      lo_style_center->alignment->horizontal = zcl_excel_style_alignment=>c_horizontal_center.
      lo_style_center->alignment->vertical = zcl_excel_style_alignment=>c_vertical_center.
      lv_style_center_guid = lo_style_center->get_guid( ).

      " 第1行表头
      lv_row = 1.
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'A' ip_value = '单位名称' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'B' ip_value = '凭证年度' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'C' ip_value = '期间' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'D' ip_value = '共几册' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'E' ip_value = '第几册' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'F' ip_value = '负责人' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'G' ip_value = '装订人' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'H' ip_value = '装订年度' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'I' ip_value = '月份' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'J' ip_value = '原始凭证' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'K' ip_value = '保管期限' ip_style = lv_style_title_guid ).
      lo_worksheet->set_cell( ip_row = lv_row ip_column = 'L' ip_value = '二维码' ip_style = lv_style_title_guid ).

      " 数据行
      LOOP AT lt_volume REFERENCE INTO DATA(lr_volume).
        lv_row += 1.
        lo_worksheet->set_row_height( ip_row = lv_row ip_height_fix = 84 ).

        " 单位名称
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'A' ip_value = lr_volume->prctr_text ip_style = lv_style_center_guid ).
        " 凭证年度
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'B' ip_value = lr_volume->gjahr ip_style = lv_style_center_guid ).
        " 凭证期间
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'C' ip_value = lr_volume->poper ip_style = lv_style_center_guid ).

        " 共几册:同PRCTR+GJAHR+POPER下ZHH最大号
        READ TABLE lt_zhh_max REFERENCE INTO DATA(lr_zhh_max) WITH KEY
          prctr = lr_volume->prctr
          gjahr = lr_volume->gjahr
          poper = lr_volume->poper
          BINARY SEARCH.
        IF sy-subrc = 0.
          lo_worksheet->set_cell( ip_row = lv_row ip_column = 'D' ip_value = lr_zhh_max->zhh_max ip_style = lv_style_center_guid ).
        ENDIF.

        " 第几册:母码ZHH
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'E' ip_value = lr_volume->zhh ip_style = lv_style_center_guid ).

        " 负责人/装订人
        READ TABLE lt_wlwz_cfg REFERENCE INTO DATA(lr_wlwz) WITH KEY
          bukrs = lr_volume->bukrs
          prctr = lr_volume->prctr
          BINARY SEARCH.
        IF sy-subrc = 0.
          lo_worksheet->set_cell( ip_row = lv_row ip_column = 'F' ip_value = lr_wlwz->zfzr ip_style = lv_style_center_guid ).
          lo_worksheet->set_cell( ip_row = lv_row ip_column = 'G' ip_value = lr_wlwz->zerp_name ip_style = lv_style_center_guid ).
        ENDIF.

        " 装订年度/装订月份:期间12则为年度+1/月份1
        DATA(lv_zd_gjahr) = lr_volume->gjahr.
        DATA(lv_zd_poper) = lr_volume->poper.
        IF lr_volume->poper = 12.
          lv_zd_gjahr = lr_volume->gjahr + 1.
          lv_zd_poper = 1.
        ENDIF.
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'H' ip_value = lv_zd_gjahr ip_style = lv_style_center_guid ).
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'I' ip_value = lv_zd_poper ip_style = lv_style_center_guid ).

        " 原始凭证:该母码下子码条数
        READ TABLE lt_sub_cnt REFERENCE INTO DATA(lr_sub_cnt) WITH KEY
          zmm_no = lr_volume->zmm_no
          zitemno = lr_volume->zitemno
          BINARY SEARCH.
        IF sy-subrc = 0.
          lo_worksheet->set_cell( ip_row = lv_row ip_column = 'J' ip_value = lr_sub_cnt->sub_count ip_style = lv_style_center_guid ).
        ENDIF.

        " 保管期限:默认30年
        lo_worksheet->set_cell( ip_row = lv_row ip_column = 'K' ip_value = '30年' ip_style = lv_style_center_guid ).

        " 二维码:生成母码二维码并插入L列单元格
        PERFORM frm_export_volume_qrcode
          USING lo_excel lo_worksheet lv_row
                lr_volume->zmm_no lr_volume->zitemno.
      ENDLOOP.

      " 列宽(参照模板)
      lo_worksheet->set_column_width( ip_column = 'A' ip_width_fix = 19 ).
      lo_worksheet->set_column_width( ip_column = 'B' ip_width_fix = 10 ).
      lo_worksheet->set_column_width( ip_column = 'C' ip_width_fix = 7 ).
      lo_worksheet->set_column_width( ip_column = 'D' ip_width_fix = 9 ).
      lo_worksheet->set_column_width( ip_column = 'E' ip_width_fix = 9 ).
      lo_worksheet->set_column_width( ip_column = 'F' ip_width_fix = 9 ).
      lo_worksheet->set_column_width( ip_column = 'G' ip_width_fix = 9 ).
      lo_worksheet->set_column_width( ip_column = 'H' ip_width_fix = 10 ).
      lo_worksheet->set_column_width( ip_column = 'I' ip_width_fix = 7 ).
      lo_worksheet->set_column_width( ip_column = 'J' ip_width_fix = 10 ).
      lo_worksheet->set_column_width( ip_column = 'K' ip_width_fix = 10 ).
      lo_worksheet->set_column_width( ip_column = 'L' ip_width_fix = 21 ).

    CATCH zcx_excel.
      MESSAGE '导出Excel文件失败' TYPE 'S' DISPLAY LIKE 'E'.
      RETURN.
  ENDTRY.

  " 写文件并保存
  DATA: lo_writer    TYPE REF TO zif_excel_writer,
        lv_file_name TYPE string,
        lv_file      TYPE xstring.

  CREATE OBJECT lo_writer TYPE zcl_excel_writer_2007.
  lv_file = lo_writer->write_file( lo_excel ).

  " 文件名:XX单位XX月实物档案归档信息表.xlsx
  " 文件名:XX单位XX月实物档案归档信息表.xlsx(单位/月份取第一行母码)
  DATA(lv_month) = |{ lt_volume[ 1 ]-poper ALPHA = OUT }|.
  CONDENSE lv_month.
  lv_file_name = |{ lt_volume[ 1 ]-prctr_text }{ lv_month }月实物档案归档信息表.xlsx|.

  lv_file_name = cl_openxml_helper=>browse_local_file_save(
    iv_title      = '保存'
    iv_filename   = lv_file_name
    iv_extpattern = '*.xlsx|*.xlsx' ).

  IF lv_file_name IS NOT INITIAL.
    TRY.
        cl_openxml_helper=>store_local_file( im_file_name = lv_file_name
                                             im_data      = lv_file ).
        MESSAGE '母码信息已导出' TYPE 'S'.
      CATCH cx_openxml_not_allowed.
        MESSAGE '保存Excel文件失败' TYPE 'S' DISPLAY LIKE 'E'.
    ENDTRY.
  ENDIF.

ENDFORM.
*&---------------------------------------------------------------------*
*& Form frm_export_volume_qrcode
*&---------------------------------------------------------------------*
*& 生成母码二维码并插入EXCEL单元格
*&---------------------------------------------------------------------*
FORM frm_export_volume_qrcode USING po_excel     TYPE REF TO zcl_excel
                                    po_worksheet TYPE REF TO zcl_excel_worksheet
                                    pv_row       TYPE i
                                    pv_zmm_no    TYPE zfit_ysfj_0003-zmm_no
                                    pv_zitemno   TYPE zfit_ysfj_0003-zitemno.

  DATA: lv_qrcode_data TYPE char255,
        lv_qrcode_name TYPE tdobname,
        lv_mess        TYPE string.

  " 二维码内容:母码页面地址
  lv_qrcode_data = zcl_zssf_http_interface=>gen_intf_url_get_parent_code(
    iv_parent_code = pv_zmm_no
    iv_itemno      = pv_zitemno ).

  IF pv_zitemno IS NOT INITIAL.
    lv_qrcode_name = |{ pv_zmm_no }-{ pv_zitemno }|.
  ELSE.
    lv_qrcode_name = |{ pv_zmm_no }|.
  ENDIF.

  " 生成二维码图形(存SE78)
  CALL FUNCTION 'ZFM_MM_QRCODE_TO_FORM'
    EXPORTING
      barcdata         = lv_qrcode_data
      filename         = lv_qrcode_name
      iv_dest_pxwidth  = 470
      iv_dest_pxheight = 470
    IMPORTING
      message          = lv_mess.
  IF lv_mess IS NOT INITIAL.
    MESSAGE i888(sabapdocu) WITH lv_mess.
    RETURN.
  ENDIF.

  " 从SE78读回二维码BMP位图数据
  DATA: lv_bytecount TYPE i,
        lt_bitmap    TYPE STANDARD TABLE OF w3mime WITH EMPTY KEY,
        lv_bmp       TYPE xstring.

  CALL FUNCTION 'SAPSCRIPT_GET_GRAPHIC_BDS'
    EXPORTING
      i_name       = lv_qrcode_name
      i_object     = 'GRAPHICS'
      i_id         = 'BMAP'
      i_btype      = 'BMON'
    IMPORTING
      bytecount    = lv_bytecount
    TABLES
      bitmap       = lt_bitmap
    EXCEPTIONS
      OTHERS       = 1.
  IF sy-subrc <> 0 OR lv_bytecount = 0.
    MESSAGE |二维码[{ lv_qrcode_name }]读取失败| TYPE 'S' DISPLAY LIKE 'E'.
    RETURN.
  ENDIF.

  " 二进制转xstring
  CALL FUNCTION 'SCMS_BINARY_TO_XSTRING'
    EXPORTING
      input_length = lv_bytecount
    IMPORTING
      buffer       = lv_bmp
    TABLES
      binary_tab   = lt_bitmap.

  " 插入到L列单元格(锚定到单元格,尺寸与单元格相当)
  TRY.
      DATA(lo_drawing) = NEW zcl_excel_drawing( ).
      lo_drawing->set_media( ip_media       = lv_bmp
                             ip_media_type  = zcl_excel_drawing=>c_media_type_bmp
                             ip_width       = 70
                             ip_height      = 70 ).
      lo_drawing->set_position( ip_from_row = pv_row
                                ip_from_col = 'L' ).
      po_worksheet->add_drawing( lo_drawing ).
    CATCH zcx_excel.
      MESSAGE '二维码插入Excel失败' TYPE 'S' DISPLAY LIKE 'E'.
  ENDTRY.

ENDFORM.
*&&--------End of Mod: S/4 SHYY_ABAP04_20.08.2026 16:47:36 母码信息导出EXCEL