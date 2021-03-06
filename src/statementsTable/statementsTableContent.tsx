import React from "react";
import { Link } from "react-router-dom";
import classNames from "classnames/bind";
import { noop } from "lodash";
import {
  Anchor,
  ActivateDiagnosticsModalRef,
  getHighlightedText,
  DiagnosticStatusBadge,
  AggregateStatistics,
  Dropdown,
  Button,
} from "src/index";
import { Tooltip2 as Tooltip } from "src/tooltip2";
import {
  statementDiagnostics,
  statementsRetries,
  statementsSql,
  statementsTimeInterval,
  transactionalPipelining,
  summarize,
  TimestampToMoment,
} from "src/util";
import { shortStatement } from "./statementsTable";
import styles from "./statementsTableContent.module.scss";
import { cockroach } from "@cockroachlabs/crdb-protobuf-client";
import { Download } from "@cockroachlabs/icons";

export type NodeNames = { [nodeId: string]: string };
const cx = classNames.bind(styles);
type IStatementDiagnosticsReport = cockroach.server.serverpb.IStatementDiagnosticsReport;

export const StatementTableTitle = {
  statements: (
    <Tooltip
      placement="bottom"
      title={
        <div className={cx("tooltip__table--title")}>
          <p>
            {"SQL statement "}
            <Anchor href={statementsSql} target="_blank">
              fingerprint.
            </Anchor>
          </p>
          <p>
            To view additional details of a SQL statement fingerprint, click
            this to open the Statement Details page.
          </p>
        </div>
      }
    >
      Statements
    </Tooltip>
  ),
  txtType: (
    <Tooltip
      placement="bottom"
      title={
        <div className={cx("tooltip__table--title")}>
          <p>
            {
              "Type of transaction (implicit or explicit). Explicit transactions refer to statements that are wrapped by "
            }
            <code>BEGIN</code>
            {" and "}
            <code>COMMIT</code>
            {" statements by the client. Explicit transactions employ "}
            <Anchor href={transactionalPipelining} target="_blank">
              transactional pipelining
            </Anchor>
            {
              " and therefore report latencies that do not account for replication."
            }
          </p>
          <p>
            For statements not in explicit transactions, CockroachDB wraps each
            statement in individual implicit transactions.
          </p>
        </div>
      }
    >
      TXN Type
    </Tooltip>
  ),
  diagnostics: (
    <Tooltip
      placement="bottom"
      title={
        <div className={cx("tooltip__table--title")}>
          <p>
            {"Option to activate "}
            <Anchor href={statementDiagnostics} target="_blank">
              diagnostics
            </Anchor>
            {
              " for each statement. If activated, this displays the status of diagnostics collection ("
            }
            <code>WAITING FOR QUERY</code>, <code>READY</code>, OR{" "}
            <code>ERROR</code>).
          </p>
        </div>
      }
    >
      Diagnostics
    </Tooltip>
  ),
  retries: (
    <Tooltip
      placement="bottom"
      title={
        <div className={cx("tooltip__table--title")}>
          <p>
            {"Cumulative number of "}
            <Anchor href={statementsRetries} target="_blank">
              retries
            </Anchor>
            {
              " of statements with this fingerprint within the last hour or specified time interval."
            }
          </p>
        </div>
      }
    >
      Retries
    </Tooltip>
  ),
  executionCount: (
    <Tooltip
      placement="bottom"
      title={
        <div className={cx("tooltip__table--title")}>
          <p>
            {
              "Cumulative number of executions of statements with this fingerprint within the last hour or specified "
            }
            <Anchor href={statementsTimeInterval} target="_blank">
              time interval
            </Anchor>
            .
          </p>
          <p>
            {"The bar indicates the ratio of runtime success (gray) to "}
            <Anchor href={statementsRetries} target="_blank">
              retries
            </Anchor>
            {" (red) for the SQL statement fingerprint."}
          </p>
        </div>
      }
    >
      Execution Count
    </Tooltip>
  ),
  rowsAffected: (
    <Tooltip
      placement="bottom"
      title={
        <div className={cx("tooltip__table--title")}>
          <p>
            {
              "Average number of rows returned while executing statements with this fingerprint within the last hour or specified "
            }
            <Anchor href={statementsTimeInterval} target="_blank">
              time interval
            </Anchor>
            .
          </p>
          <p>
            The gray bar indicates the mean number of rows returned. The blue
            bar indicates one standard deviation from the mean.
          </p>
        </div>
      }
    >
      Rows Affected
    </Tooltip>
  ),
  latency: (
    <Tooltip
      placement="bottom"
      title={
        <div className={cx("tooltip__table--title")}>
          <p>
            Average service latency of statements with this fingerprint within
            the last hour or specified time interval.
          </p>
          <p>
            The gray bar indicates the mean latency. The blue bar indicates one
            standard deviation from the mean.
          </p>
        </div>
      }
    >
      Latency
    </Tooltip>
  ),
};

export const StatementTableCell = {
  statements: (search?: string, selectedApp?: string) => (stmt: any) => (
    <StatementLink
      statement={stmt.label}
      implicitTxn={stmt.implicitTxn}
      search={search}
      app={selectedApp}
    />
  ),
  diagnostics: (
    activateDiagnosticsRef: React.RefObject<ActivateDiagnosticsModalRef>,
    onDiagnosticsDownload: (report: IStatementDiagnosticsReport) => void = noop,
  ) => (stmt: AggregateStatistics) => {
    /*
     * Diagnostics cell might display different components depending
     * on following states:
     * - show `Activate` link only if no completed or waiting reports available;
     * - show `WAITING` badge only if report requested for the first time;
     * - show `WAITING` badge and dropdown with download links if report is currently
     * requested and previous reports are available for download;
     * - show `Activate` link and dropdown with download links if there is completed
     * reports only;
     * */
    const hasDiagnosticReports = !!stmt.diagnosticsReports;
    const hasCompletedDiagnosticsReports =
      hasDiagnosticReports && stmt.diagnosticsReports.some(d => d.completed);
    const canActivateDiagnosticReport = hasDiagnosticReports
      ? stmt.diagnosticsReports.every(d => d.completed)
      : true;

    return (
      <div className={cx("activate-diagnostic-col")}>
        {canActivateDiagnosticReport ? (
          <Button
            onClick={() =>
              activateDiagnosticsRef?.current?.showModalFor(stmt.label)
            }
            type="secondary"
            size="small"
          >
            Activate
          </Button>
        ) : (
          <DiagnosticStatusBadge status="WAITING" />
        )}
        {hasCompletedDiagnosticsReports && (
          <Dropdown<IStatementDiagnosticsReport>
            items={stmt.diagnosticsReports
              .filter(dr => dr.completed)
              .map(dr => ({
                name: (
                  <a
                    className={cx("download-diagnostics-link")}
                    href={`_admin/v1/stmtbundle/${dr.statement_diagnostics_id}`}
                  >
                    {`${TimestampToMoment(dr.requested_at).format(
                      "ll [at] LT [diagnostic]",
                    )}`}
                  </a>
                ),
                value: dr,
              }))}
            onChange={onDiagnosticsDownload}
            menuPosition="right"
            customToggleButtonOptions={{
              size: "small",
              icon: <Download />,
              textAlign: "center",
            }}
            className={cx("activate-diagnostic-dropdown")}
          />
        )}
      </div>
    );
  },
  nodeLink: (nodeNames: NodeNames) => (stmt: any) => (
    <NodeLink nodeId={stmt.label} nodeNames={nodeNames} />
  ),
};

export const StatementLink = (props: {
  statement: string;
  app: string;
  implicitTxn: boolean;
  search: string;
}) => {
  const summary = summarize(props.statement);
  const base =
    props.app && props.app.length > 0
      ? `/statements/${props.app}/${props.implicitTxn}`
      : `/statement/${props.implicitTxn}`;
  return (
    <Link to={`${base}/${encodeURIComponent(props.statement)}`}>
      <div>
        <Tooltip
          placement="bottom"
          title={
            <pre className={cx("cl-table-link__description")}>
              {getHighlightedText(props.statement, props.search)}
            </pre>
          }
          overlayClassName={cx("cl-table-link__statement-tooltip--fixed-width")}
        >
          <div className={cx("cl-table-link__tooltip-hover-area")}>
            {getHighlightedText(
              shortStatement(summary, props.statement),
              props.search,
              true,
            )}
          </div>
        </Tooltip>
      </div>
    </Link>
  );
};

const NodeLink = (props: { nodeId: string; nodeNames: NodeNames }) => (
  <Link to={`/node/${props.nodeId}`}>
    <div className={cx("node-name-tooltip__info-icon")}>
      {props.nodeNames[props.nodeId]}
    </div>
  </Link>
);
